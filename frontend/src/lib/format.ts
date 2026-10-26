// Formatação e datas, portadas do design (brl, brl0, daysLeft, paras).

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const BRL0 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const brl = (cents: number) => BRL.format(cents / 100);
export const brl0 = (cents: number) => BRL0.format(cents / 100);

// "100", "100,50", "1.234,56", "1.500" → centavos. Inválido ou vazio → 0.
export function parseBrlToCents(input: string): number {
  const clean = input.trim().replace(/[R$\s]/g, "");
  if (!clean) return 0;
  const thousandsOnly = /^\d{1,3}(\.\d{3})+$/.test(clean); // "1.500" = mil e quinhentos
  const normalized =
    clean.includes(",") || thousandsOnly ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : 0;
}

// Dias inteiros entre hoje (fuso local) e a data "AAAA-MM-DD"; negativo depois do evento.
export function daysLeft(isoDate: string, now = new Date()): number | null {
  if (!isoDate) return null;
  const [y, m, d] = isoDate.split("-").map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 864e5);
}

// Texto com linha em branco entre parágrafos → lista de parágrafos (cada um com suas quebras).
export const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
