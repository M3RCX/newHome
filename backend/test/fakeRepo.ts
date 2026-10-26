// Repo em memória para os testes da API. Reproduz as regras da RPC create_contribution.
import { randomUUID } from "node:crypto";
import { HttpError } from "../src/errors.js";
import {
  computeStatus,
  type AdminProduct,
  type Contribution,
  type ProductInput,
  type Repo,
} from "../src/repo.js";

type StoredProduct = ProductInput & { id: string; createdAt: string; updatedAt: string };

export function createFakeRepo(seed: Partial<ProductInput>[] = []) {
  const products: StoredProduct[] = [];
  const contributions: Contribution[] = [];
  const images = new Map<string, { bytes: Buffer; contentType: string }>();
  let healthy = true;

  const now = () => new Date().toISOString();
  const imageUrl = (path: string | null) => (path ? `https://cdn.test/${path}` : null);

  const toAdmin = (p: StoredProduct): AdminProduct => {
    const list = contributions.filter((c) => c.productId === p.id);
    return {
      id: p.id,
      slug: p.slug,
      kind: p.kind,
      room: p.room,
      name: p.name,
      spec: p.spec,
      priceCents: p.priceCents,
      purchaseUrl: p.purchaseUrl,
      imagePath: p.imagePath,
      imageUrl: imageUrl(p.imagePath),
      sortOrder: p.sortOrder,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      status: computeStatus(p.kind, list),
      contributions: list,
    };
  };

  const insert = (input: ProductInput) => {
    if (products.some((p) => p.slug === input.slug)) throw new HttpError(409, "slug_taken");
    const stored = { ...input, id: randomUUID(), createdAt: now(), updatedAt: now() };
    products.push(stored);
    return stored;
  };

  seed.forEach((s, i) =>
    insert({
      slug: `p${i}`,
      kind: "item",
      room: "Cozinha",
      name: `Produto ${i}`,
      spec: "",
      priceCents: 10000,
      purchaseUrl: null,
      imagePath: null,
      sortOrder: i,
      ...s,
    }),
  );

  const repo: Repo = {
    async ping() {
      if (!healthy) throw new Error("db down");
    },
    async listPublicProducts() {
      return [...products]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((p) => {
          const { id, imagePath, sortOrder, createdAt, updatedAt, contributions: _c, ...pub } = toAdmin(p);
          return pub;
        });
    },
    async createContribution(slug, input) {
      const product = products.find((p) => p.slug === slug);
      if (!product) throw new HttpError(404, "product_not_found");
      const existing = contributions.filter((c) => c.productId === product.id);
      let amount: number | null | undefined;
      if (product.kind === "cota") {
        if (input.mode !== "pix") throw new HttpError(400, "cota_only_pix");
        amount = product.priceCents > 0 ? product.priceCents : input.amountCents;
      } else {
        if (existing.some((c) => c.mode === "levar" || c.mode === "pix")) throw new HttpError(409, "already_chosen");
        if (input.mode === "parte") {
          if (product.priceCents < 60000) throw new HttpError(400, "parte_not_allowed");
          amount = input.amountCents;
        } else {
          amount = product.priceCents;
        }
      }
      if (input.mode !== "levar" && (!amount || amount <= 0)) throw new HttpError(400, "invalid_amount");
      const contribution: Contribution = {
        id: randomUUID(),
        productId: product.id,
        guestName: input.guestName.trim(),
        mode: input.mode,
        amountCents: amount ?? 0,
        createdAt: now(),
      };
      contributions.push(contribution);
      return contribution;
    },
    async listAdminProducts() {
      return [...products].sort((a, b) => a.sortOrder - b.sortOrder).map(toAdmin);
    },
    async getProduct(id) {
      const p = products.find((x) => x.id === id);
      return p ? toAdmin(p) : null;
    },
    async nextSortOrder() {
      return products.reduce((max, p) => Math.max(max, p.sortOrder), -1) + 1;
    },
    async insertProduct(input) {
      return toAdmin(insert(input));
    },
    async updateProduct(id, patch) {
      const p = products.find((x) => x.id === id);
      if (!p) throw new HttpError(404, "product_not_found");
      if (patch.slug && products.some((x) => x.slug === patch.slug && x.id !== id)) {
        throw new HttpError(409, "slug_taken");
      }
      Object.assign(p, patch, { updatedAt: now() });
      return toAdmin(p);
    },
    async deleteProduct(id) {
      const i = products.findIndex((x) => x.id === id);
      if (i >= 0) products.splice(i, 1);
      for (let j = contributions.length - 1; j >= 0; j--) {
        if (contributions[j].productId === id) contributions.splice(j, 1);
      }
    },
    async uploadImage(path, bytes, contentType) {
      images.set(path, { bytes, contentType });
    },
    async removeImage(path) {
      images.delete(path);
    },
    async listContributions(productId) {
      return contributions.filter((c) => !productId || c.productId === productId).reverse();
    },
    async updateContribution(id, patch) {
      const c = contributions.find((x) => x.id === id);
      if (!c) throw new HttpError(404, "contribution_not_found");
      Object.assign(c, patch);
      return c;
    },
    async deleteContribution(id) {
      const i = contributions.findIndex((x) => x.id === id);
      if (i < 0) throw new HttpError(404, "contribution_not_found");
      contributions.splice(i, 1);
    },
  };

  return {
    repo,
    products,
    contributions,
    images,
    setHealthy: (value: boolean) => {
      healthy = value;
    },
  };
}
