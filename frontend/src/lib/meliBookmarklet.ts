// Favorito (bookmarklet) que lê a página de um produto no Mercado Livre e abre o formulário do admin preenchido.
// Roda no navegador de quem clica, então não esbarra no bloqueio que o Mercado Livre faz a servidores.
import extractSource from "../bookmarklet/extract.js?raw";

export type MeliPayload = {
  name: string;
  spec: string;
  priceCents: number;
  imageUrl: string | null;
  url: string | null;
};

export const NEW_PRODUCT_PATH = "/admin/presentes/novo";
const MELI_PAGE = /^https:\/\/[^/\s]*mercadoli(vre|bre)\.com/i;
const MLSTATIC = /^https:\/\/([a-z0-9-]+\.)*mlstatic\.com\//i;

// Código do favorito. `origin` é o endereço do site/admin onde o formulário vai abrir.
export function buildBookmarklet(origin: string): { code: string; href: string } {
  const extract = extractSource.trim().replace(/;$/, "");
  const code =
    `(function(){var d=(${extract})(document,location);` +
    `if(!d||!d.name){alert("Não encontrei os dados do produto nesta página. Abra a página de um produto do Mercado Livre e tente de novo.");return;}` +
    `var w=window.open(${JSON.stringify(origin)}+${JSON.stringify(NEW_PRODUCT_PATH)}+"#ml="+encodeURIComponent(JSON.stringify(d)),"_blank");` +
    `if(!w){alert("O navegador bloqueou a nova aba. Permita pop-ups para o Mercado Livre e tente de novo.");}})();`;
  return { code, href: `javascript:${encodeURIComponent(code)}` };
}

// Lê e valida o que veio no endereço (#ml=…). Só vira texto de formulário: nada é salvo sem o clique do admin.
export function parseMeliHash(hash: string): MeliPayload | null {
  const match = /^#ml=(.+)$/.exec(hash);
  if (!match) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

  const name = str(r.name, 200);
  if (!name) return null;
  const cents = typeof r.priceCents === "number" && Number.isInteger(r.priceCents) ? r.priceCents : 0;
  const imageUrl = str(r.imageUrl, 1000);
  const url = str(r.url, 1000);
  return {
    name,
    spec: str(r.spec, 1000),
    priceCents: cents > 0 && cents < 100_000_000 ? cents : 0,
    imageUrl: MLSTATIC.test(imageUrl) ? imageUrl : null, // o servidor só baixa fotos do CDN do Mercado Livre
    url: MELI_PAGE.test(url) ? url : null,
  };
}
