// Preenchimento de produto a partir de um link do Mercado Livre (API oficial, app com client_credentials).
// As páginas do ML bloqueiam leitura automática; a API é o caminho suportado. Sem credenciais, ou se a
// API falhar, devolvemos só o nome tirado do próprio link e o formulário continua manual.
import { HttpError } from "../errors.js";

export type ProductPreview = {
  name: string;
  spec: string;
  priceCents: number | null;
  imageUrl: string | null;
  purchaseUrl: string;
  source: "api" | "link";
  warning: null | "meli_not_configured" | "meli_unavailable" | "meli_not_found";
};

export interface Meli {
  preview(url: string): Promise<ProductPreview>;
  downloadImage(url: string): Promise<{ bytes: Buffer; contentType: string }>;
}

export type MeliCredentials = { clientId: string; clientSecret: string };

const API = "https://api.mercadolibre.com";
const MELI_HOST = /(^|\.)mercadoli(vre|bre)\.com(\.br)?$/i;
const IMAGE_HOST = /(^|\.)mlstatic\.com$/i;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 8000;

export type MeliRef = {
  url: string;
  itemId?: string; // anúncio específico (MLB123...)
  productId?: string; // produto de catálogo (/p/MLB123)
  userProductId?: string; // produto do vendedor (/up/MLBU123)
  slug: string;
};

// Aceita só links do Mercado Livre Brasil. Formatos: /<slug>/p/MLB…, /<slug>/up/MLBU…,
// produto.mercadolivre.com.br/MLB-123456-<slug>-_JM, e ?pdp_filters=item_id:MLB… / ?wid=MLB…
export function parseMeliUrl(raw: string): MeliRef {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new HttpError(400, "invalid_url");
  }
  if (!/^https?:$/.test(url.protocol) || !MELI_HOST.test(url.hostname)) throw new HttpError(400, "invalid_url");

  let path = url.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    // mantém o caminho como veio
  }

  const itemFromQuery =
    /item_id:(MLB\d+)/i.exec(url.searchParams.get("pdp_filters") ?? "")?.[1] ?? /^(MLB\d+)$/i.exec(url.searchParams.get("wid") ?? "")?.[1];
  const legacy = /\/MLB-?(\d{6,})-([^/?#]*)/i.exec(path); // produto.mercadolivre.com.br/MLB-123456-nome-_JM
  const productId = /\/p\/(MLB\d+)/i.exec(path)?.[1];
  const userProductId = /\/up\/(MLBU\d+)/i.exec(path)?.[1];
  const itemId = (itemFromQuery ?? (legacy ? `MLB${legacy[1]}` : undefined))?.toUpperCase();

  const slug = legacy
    ? legacy[2].replace(/-?_JM$/i, "")
    : (path.split("/").filter(Boolean)[0] ?? "").replace(/^MLB-?\d+-?/i, "");

  if (!itemId && !productId && !userProductId) throw new HttpError(400, "invalid_url");
  return { url: url.toString(), itemId, productId: productId?.toUpperCase(), userProductId: userProductId?.toUpperCase(), slug };
}

export function slugToName(slug: string): string {
  const text = slug.replace(/[-_]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "Presente";
}

type Attribute = { id?: string; value_name?: string | null };
type Picture = { url?: string; secure_url?: string };

const SPEC_ATTRIBUTES: [id: string, label: string][] = [
  ["BRAND", "Marca"],
  ["MODEL", "Modelo"],
  ["COLOR", "Cor"],
  ["MAIN_COLOR", "Cor"],
  ["SIZE", "Tamanho"],
  ["CAPACITY", "Capacidade"],
  ["VOLUME", "Volume"],
  ["VOLTAGE", "Voltagem"],
  ["POWER", "Potência"],
  ["MATERIAL", "Material"],
];

function buildSpec(attributes: Attribute[] | undefined): string {
  const seen = new Set<string>();
  const parts: string[] = [];
  for (const [id, label] of SPEC_ATTRIBUTES) {
    const value = attributes?.find((a) => a.id === id)?.value_name?.trim();
    if (!value || seen.has(label)) continue;
    seen.add(label);
    parts.push(`${label}: ${value}.`);
  }
  return parts.join(" ").slice(0, 1000);
}

const https = (u: string | undefined) => (u ? u.replace(/^http:/, "https:") : null);
const firstImage = (pictures: Picture[] | undefined, thumbnail?: string) =>
  https(pictures?.[0]?.secure_url ?? pictures?.[0]?.url ?? thumbnail);
const toCents = (price: unknown) => (typeof price === "number" && price > 0 ? Math.round(price * 100) : null);

type Extracted = Pick<ProductPreview, "name" | "spec" | "priceCents" | "imageUrl">;

function fromItem(item: Record<string, any> | null): Extracted | null {
  if (!item || typeof item.title !== "string") return null;
  return {
    name: item.title.trim(),
    spec: buildSpec(item.attributes),
    priceCents: toCents(item.price),
    imageUrl: firstImage(item.pictures, item.thumbnail),
  };
}

function fromCatalog(product: Record<string, any> | null): Extracted | null {
  if (!product || typeof product.name !== "string") return null;
  return {
    name: product.name.trim(),
    spec: buildSpec(product.attributes),
    priceCents: toCents(product.buy_box_winner?.price),
    imageUrl: firstImage(product.pictures),
  };
}

export function createMeli(credentials: MeliCredentials | null, fetchFn: typeof fetch = fetch): Meli {
  let token: { value: string; expiresAt: number } | null = null;

  async function getToken(): Promise<string> {
    if (token && token.expiresAt > Date.now() + 60_000) return token.value;
    const res = await fetchFn(`${API}/oauth/token`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: credentials!.clientId,
        client_secret: credentials!.clientSecret,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`meli token ${res.status}`);
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) throw new Error("meli token vazio");
    token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
    return token.value;
  }

  // 404 → null (não existe); 401 → renova o token uma vez; outros erros sobem.
  async function get(path: string, retry = true): Promise<Record<string, any> | null> {
    const res = await fetchFn(`${API}${path}`, {
      headers: { accept: "application/json", authorization: `Bearer ${await getToken()}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (res.status === 404) return null;
    if (res.status === 401 && retry) {
      token = null;
      return get(path, false);
    }
    if (!res.ok) throw new Error(`meli ${path} ${res.status}`);
    return (await res.json()) as Record<string, any>;
  }

  return {
    async preview(raw) {
      const ref = parseMeliUrl(raw);
      const fallback = (warning: NonNullable<ProductPreview["warning"]>): ProductPreview => ({
        name: slugToName(ref.slug),
        spec: "",
        priceCents: null,
        imageUrl: null,
        purchaseUrl: ref.url,
        source: "link",
        warning,
      });
      if (!credentials) return fallback("meli_not_configured");

      try {
        let found: Extracted | null = null;
        if (ref.itemId) found = fromItem(await get(`/items/${ref.itemId}`));
        if (!found && ref.productId) found = fromCatalog(await get(`/products/${ref.productId}`));
        if (!found && ref.userProductId) found = fromCatalog(await get(`/user-products/${ref.userProductId}`));
        if (!found) return fallback("meli_not_found");
        return { ...found, purchaseUrl: ref.url, source: "api", warning: null };
      } catch (err) {
        console.warn("Mercado Livre indisponível:", err instanceof Error ? err.message : err);
        return fallback("meli_unavailable");
      }
    },

    // Baixa a foto do produto (só do CDN do ML) para o servidor guardar no nosso Storage.
    async downloadImage(raw) {
      let url: URL;
      try {
        url = new URL(raw);
      } catch {
        throw new HttpError(400, "invalid_image_url");
      }
      if (url.protocol !== "https:" || !IMAGE_HOST.test(url.hostname)) throw new HttpError(400, "invalid_image_url");

      let res: Response;
      try {
        res = await fetchFn(url, { redirect: "error", headers: { accept: "image/*" }, signal: AbortSignal.timeout(10_000) });
      } catch {
        throw new HttpError(502, "image_download_failed");
      }
      if (!res.ok) throw new HttpError(502, "image_download_failed");

      const contentType = res.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
      if (!IMAGE_TYPES.has(contentType)) throw new HttpError(400, "invalid_image_type");
      if (Number(res.headers.get("content-length")) > MAX_IMAGE_BYTES) throw new HttpError(413, "image_too_large");

      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length > MAX_IMAGE_BYTES) throw new HttpError(413, "image_too_large");
      return { bytes, contentType };
    },
  };
}
