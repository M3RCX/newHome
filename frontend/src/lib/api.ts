// Cliente da API. Mesmo domínio na Netlify (/api → function), então caminhos relativos.
import type { NewContribution, Product } from "./types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    });
  } catch {
    throw new ApiError(0, "network_error");
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body?.error ?? "unknown_error");
  return body as T;
}

export const api = {
  listProducts: () => request<{ products: Product[] }>("/products").then((r) => r.products),

  contribute: (slug: string, input: NewContribution) =>
    request<{ slug: string; mode: string; amountCents: number }>(
      `/products/${encodeURIComponent(slug)}/contributions`,
      { method: "POST", body: JSON.stringify(input) },
    ),
};

// Mensagens para os códigos de erro da API que o convidado pode ver.
export function errorMessage(err: unknown): string {
  const code = err instanceof ApiError ? err.code : "unknown_error";
  switch (code) {
    case "already_chosen":
      return "Poxa, alguém acabou de escolher este presente. Dá uma olhada nos outros!";
    case "invalid_amount":
      return "Informe um valor maior que zero.";
    case "too_many_requests":
      return "Muitas tentativas seguidas. Espere alguns minutos e tente de novo.";
    case "product_not_found":
      return "Este presente não está mais na lista.";
    case "network_error":
      return "Sem conexão. Confira a internet e tente de novo.";
    default:
      return "Não deu pra registrar agora. Tente de novo em instantes.";
  }
}
