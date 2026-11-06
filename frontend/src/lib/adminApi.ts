// Cliente das rotas /api/admin com o token JWT salvo no navegador.
import { useSyncExternalStore } from "react";
import { ApiError } from "./api";
import type { ContributionMode, ProductKind, ProductStatus } from "./types";

export type Contribution = {
  id: string;
  productId: string;
  guestName: string;
  mode: ContributionMode;
  amountCents: number;
  createdAt: string;
};

export type AdminProduct = {
  id: string;
  slug: string;
  kind: ProductKind;
  room: string;
  name: string;
  spec: string;
  priceCents: number;
  purchaseUrl: string | null;
  imagePath: string | null;
  imageUrl: string | null;
  sortOrder: number;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
  contributions: Contribution[];
};

export type Summary = {
  items: { total: number; chosen: number; free: number };
  byMode: Record<ContributionMode, number>;
  pixTotalCents: number;
  vales: { slug: string; name: string; count: number; totalCents: number }[];
  partes: { slug: string; name: string; count: number; totalCents: number }[];
};

// Dados lidos de um link do Mercado Livre (POST /api/admin/product-preview).
export type ProductPreview = {
  name: string;
  spec: string;
  priceCents: number | null;
  imageUrl: string | null;
  purchaseUrl: string;
  source: "api" | "link";
  warning: null | "meli_not_configured" | "meli_unavailable" | "meli_restricted" | "meli_not_found";
};

// ---- sessão (token no localStorage, observável pelo React) ----

const TOKEN_KEY = "casa-nova:admin-token";
type Session = { token: string; email: string; expiresAt: string };
const listeners = new Set<() => void>();
let cached: Session | null | undefined;

function readSession(): Session | null {
  if (cached !== undefined) return cached;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    const s = raw ? (JSON.parse(raw) as Session) : null;
    cached = s && new Date(s.expiresAt).getTime() > Date.now() ? s : null;
  } catch {
    cached = null;
  }
  return cached;
}

function writeSession(s: Session | null) {
  cached = s;
  try {
    if (s) localStorage.setItem(TOKEN_KEY, JSON.stringify(s));
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // modo privado/bloqueado: a sessão vale só enquanto a aba estiver aberta
  }
  listeners.forEach((l) => l());
}

export const logout = () => writeSession(null);

export function useSession() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    readSession,
    () => null,
  );
}

// ---- requisições ----

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = readSession();
  const isForm = init.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body && !isForm ? { "Content-Type": "application/json" } : {}),
        ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, "network_error");
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    // Token expirado ou inválido: encerra a sessão e o dashboard volta ao login.
    if (res.status === 401 && path !== "/auth/login") logout();
    throw new ApiError(res.status, body?.error ?? "unknown_error");
  }
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) });

export const adminApi = {
  async login(email: string, password: string) {
    const s = await request<Session>("/auth/login", json("POST", { email, password }));
    writeSession(s);
    return s;
  },

  listProducts: () => request<{ products: AdminProduct[] }>("/admin/products").then((r) => r.products),
  getProduct: (id: string) => request<{ product: AdminProduct }>(`/admin/products/${id}`).then((r) => r.product),
  createProduct: (form: FormData) =>
    request<{ product: AdminProduct }>("/admin/products", { method: "POST", body: form }).then((r) => r.product),
  updateProduct: (id: string, form: FormData) =>
    request<{ product: AdminProduct }>(`/admin/products/${id}`, { method: "PUT", body: form }).then((r) => r.product),
  deleteProduct: (id: string) => request<null>(`/admin/products/${id}`, { method: "DELETE" }),

  createContribution: (input: { productSlug: string; guestName: string; mode: ContributionMode; amountCents?: number }) =>
    request<{ contribution: Contribution }>("/admin/contributions", json("POST", input)).then((r) => r.contribution),
  updateContribution: (id: string, patch: Partial<Pick<Contribution, "guestName" | "mode" | "amountCents">>) =>
    request<{ contribution: Contribution }>(`/admin/contributions/${id}`, json("PUT", patch)).then((r) => r.contribution),
  deleteContribution: (id: string) => request<null>(`/admin/contributions/${id}`, { method: "DELETE" }),

  summary: () => request<Summary>("/admin/summary"),

  previewProduct: (url: string) => request<ProductPreview>("/admin/product-preview", json("POST", { url })),
};

// Mensagens dos erros que o admin pode ver.
export function adminErrorMessage(err: unknown): string {
  const code = err instanceof ApiError ? err.code : "unknown_error";
  const messages: Record<string, string> = {
    invalid_credentials: "E-mail ou senha incorretos.",
    too_many_requests: "Muitas tentativas. Espere um minuto e tente de novo.",
    slug_taken: "Já existe um presente com essa chave única.",
    already_chosen: "Este item já foi escolhido por outra pessoa.",
    parte_not_allowed: "Só itens a partir de R$ 600 aceitam parte.",
    cota_only_pix: "Vales só aceitam Pix.",
    invalid_amount: "Informe um valor maior que zero.",
    invalid_image_type: "A foto precisa ser JPG, PNG ou WebP.",
    invalid_url: "Cole o link completo da página do produto no Mercado Livre.",
    invalid_image_url: "Não consegui usar a foto do link. Envie a foto manualmente.",
    image_download_failed: "Não consegui baixar a foto do Mercado Livre. Remova a foto e envie uma manualmente.",
    image_too_large: "A foto ficou grande demais (máx. 4 MB).",
    invalid_body: "Confira os campos destacados.",
    network_error: "Sem conexão com o servidor.",
    product_not_found: "Este presente não existe mais.",
    contribution_not_found: "Esta contribuição não existe mais.",
  };
  return messages[code] ?? "Algo deu errado. Tente de novo.";
}
