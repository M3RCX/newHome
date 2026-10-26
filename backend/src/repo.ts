// Acesso a dados. As rotas dependem só da interface Repo; os testes usam uma versão em memória.
import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "./errors.js";

export const IMAGE_BUCKET = "products";

export type ProductKind = "item" | "cota";
export type ContributionMode = "levar" | "pix" | "parte";
export type ProductStatus = "livre" | "escolhido";

export type PublicProduct = {
  slug: string;
  kind: ProductKind;
  room: string;
  name: string;
  spec: string;
  priceCents: number;
  purchaseUrl: string | null;
  imageUrl: string | null;
  status: ProductStatus;
};

export type Contribution = {
  id: string;
  productId: string;
  guestName: string;
  mode: ContributionMode;
  amountCents: number;
  createdAt: string;
};

export type AdminProduct = PublicProduct & {
  id: string;
  imagePath: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  contributions: Contribution[];
};

export type ProductInput = {
  slug: string;
  kind: ProductKind;
  room: string;
  name: string;
  spec: string;
  priceCents: number;
  purchaseUrl: string | null;
  imagePath: string | null;
  sortOrder: number;
};

export type NewContribution = {
  guestName: string;
  mode: ContributionMode;
  amountCents?: number | null;
};

export type ContributionPatch = Partial<Pick<Contribution, "guestName" | "mode" | "amountCents">>;

export interface Repo {
  ping(): Promise<void>;
  listPublicProducts(): Promise<PublicProduct[]>;
  createContribution(slug: string, input: NewContribution): Promise<Contribution>;

  listAdminProducts(): Promise<AdminProduct[]>;
  getProduct(id: string): Promise<AdminProduct | null>;
  nextSortOrder(): Promise<number>;
  insertProduct(input: ProductInput): Promise<AdminProduct>;
  updateProduct(id: string, patch: Partial<ProductInput>): Promise<AdminProduct>;
  deleteProduct(id: string): Promise<void>;

  uploadImage(path: string, bytes: Buffer, contentType: string): Promise<void>;
  removeImage(path: string): Promise<void>;

  listContributions(productId?: string): Promise<Contribution[]>;
  updateContribution(id: string, patch: ContributionPatch): Promise<Contribution>;
  deleteContribution(id: string): Promise<void>;
}

// Item fica "escolhido" com uma contribuição levar/pix; vales nunca fecham (mesma regra da view).
export function computeStatus(kind: ProductKind, contributions: Pick<Contribution, "mode">[]): ProductStatus {
  return kind === "item" && contributions.some((c) => c.mode === "levar" || c.mode === "pix")
    ? "escolhido"
    : "livre";
}

type ProductRow = {
  id: string;
  slug: string;
  kind: ProductKind;
  room: string;
  name: string;
  spec: string;
  price_cents: number;
  purchase_url: string | null;
  image_path: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type ContributionRow = {
  id: string;
  product_id: string;
  guest_name: string;
  mode: ContributionMode;
  amount_cents: number;
  created_at: string;
};

const toContribution = (row: ContributionRow): Contribution => ({
  id: row.id,
  productId: row.product_id,
  guestName: row.guest_name,
  mode: row.mode,
  amountCents: row.amount_cents,
  createdAt: row.created_at,
});

function toProductRow(input: Partial<ProductInput>) {
  const row: Partial<ProductRow> = {};
  if (input.slug !== undefined) row.slug = input.slug;
  if (input.kind !== undefined) row.kind = input.kind;
  if (input.room !== undefined) row.room = input.room;
  if (input.name !== undefined) row.name = input.name;
  if (input.spec !== undefined) row.spec = input.spec;
  if (input.priceCents !== undefined) row.price_cents = input.priceCents;
  if (input.purchaseUrl !== undefined) row.purchase_url = input.purchaseUrl;
  if (input.imagePath !== undefined) row.image_path = input.imagePath;
  if (input.sortOrder !== undefined) row.sort_order = input.sortOrder;
  return row;
}

// Converte erros do PostgREST/RPC (SQLSTATE PTxxx e constraints) em HttpError.
function fail(error: PostgrestError): never {
  const status = /^PT(\d{3})$/.exec(error.code)?.[1];
  if (status) throw new HttpError(Number(status), error.message);
  if (error.code === "23505") throw new HttpError(409, "slug_taken");
  if (error.code === "23514" || error.code === "22P02") throw new HttpError(400, "invalid_value", error.message);
  throw new Error(`Supabase: ${error.code} ${error.message}`);
}

const PRODUCT_WITH_CONTRIBUTIONS = "*, contributions(*)";

export function createSupabaseRepo(url: string, serviceRoleKey: string): Repo {
  const db: SupabaseClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const imageUrl = (path: string | null) =>
    path ? db.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl : null;

  const toAdminProduct = (row: ProductRow & { contributions: ContributionRow[] }): AdminProduct => {
    const contributions = row.contributions
      .map(toContribution)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return {
      id: row.id,
      slug: row.slug,
      kind: row.kind,
      room: row.room,
      name: row.name,
      spec: row.spec,
      priceCents: row.price_cents,
      purchaseUrl: row.purchase_url,
      imagePath: row.image_path,
      imageUrl: imageUrl(row.image_path),
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      status: computeStatus(row.kind, contributions),
      contributions,
    };
  };

  return {
    async ping() {
      const { error } = await db.from("products").select("id", { head: true, count: "exact" }).limit(1);
      if (error) fail(error);
    },

    async listPublicProducts() {
      const { data, error } = await db
        .from("public_products")
        .select("slug, kind, room, name, spec, price_cents, purchase_url, image_path, status")
        .order("sort_order");
      if (error) fail(error);
      return data.map((row) => ({
        slug: row.slug,
        kind: row.kind,
        room: row.room,
        name: row.name,
        spec: row.spec,
        priceCents: row.price_cents,
        purchaseUrl: row.purchase_url,
        imageUrl: imageUrl(row.image_path),
        status: row.status,
      }));
    },

    async createContribution(slug, input) {
      const { data, error } = await db
        .rpc("create_contribution", {
          p_slug: slug,
          p_guest_name: input.guestName,
          p_mode: input.mode,
          p_amount_cents: input.amountCents ?? null,
        })
        .single<ContributionRow>();
      if (error) fail(error);
      return toContribution(data);
    },

    async listAdminProducts() {
      const { data, error } = await db.from("products").select(PRODUCT_WITH_CONTRIBUTIONS).order("sort_order");
      if (error) fail(error);
      return data.map(toAdminProduct);
    },

    async getProduct(id) {
      const { data, error } = await db.from("products").select(PRODUCT_WITH_CONTRIBUTIONS).eq("id", id).maybeSingle();
      if (error) fail(error);
      return data ? toAdminProduct(data) : null;
    },

    async nextSortOrder() {
      const { data, error } = await db
        .from("products")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) fail(error);
      return (data?.sort_order ?? -1) + 1;
    },

    async insertProduct(input) {
      const { data, error } = await db
        .from("products")
        .insert(toProductRow(input))
        .select(PRODUCT_WITH_CONTRIBUTIONS)
        .single();
      if (error) fail(error);
      return toAdminProduct(data);
    },

    async updateProduct(id, patch) {
      const { data, error } = await db
        .from("products")
        .update(toProductRow(patch))
        .eq("id", id)
        .select(PRODUCT_WITH_CONTRIBUTIONS)
        .maybeSingle();
      if (error) fail(error);
      if (!data) throw new HttpError(404, "product_not_found");
      return toAdminProduct(data);
    },

    async deleteProduct(id) {
      const { error } = await db.from("products").delete().eq("id", id);
      if (error) fail(error);
    },

    async uploadImage(path, bytes, contentType) {
      const { error } = await db.storage.from(IMAGE_BUCKET).upload(path, bytes, { contentType, upsert: true });
      if (error) throw new Error(`Storage: ${error.message}`);
    },

    async removeImage(path) {
      const { error } = await db.storage.from(IMAGE_BUCKET).remove([path]);
      if (error) throw new Error(`Storage: ${error.message}`);
    },

    async listContributions(productId) {
      let query = db.from("contributions").select("*").order("created_at", { ascending: false });
      if (productId) query = query.eq("product_id", productId);
      const { data, error } = await query;
      if (error) fail(error);
      return data.map(toContribution);
    },

    async updateContribution(id, patch) {
      const row: Partial<ContributionRow> = {};
      if (patch.guestName !== undefined) row.guest_name = patch.guestName;
      if (patch.mode !== undefined) row.mode = patch.mode;
      if (patch.amountCents !== undefined) row.amount_cents = patch.amountCents;
      const { data, error } = await db.from("contributions").update(row).eq("id", id).select("*").maybeSingle();
      if (error) fail(error);
      if (!data) throw new HttpError(404, "contribution_not_found");
      return toContribution(data);
    },

    async deleteContribution(id) {
      const { data, error } = await db.from("contributions").delete().eq("id", id).select("id");
      if (error) fail(error);
      if (!data.length) throw new HttpError(404, "contribution_not_found");
    },
  };
}
