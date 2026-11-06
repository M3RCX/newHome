// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { buildBookmarklet, parseMeliHash } from "./meliBookmarklet";

const ORIGIN = "http://localhost:8888";
const PAGE = "https://www.mercadolivre.com.br/jogo-zelda/up/MLBU2296026608?pdp_filters=item_id%3AMLB3592532790#polycard_client=search&wid=MLB3592532790&sid=search";

const LD_PAGE = `
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Jogo The Legend Of Zelda: Tears Of The Kingdom - Switch - Físico",
    image: ["http://http2.mlstatic.com/D_NQ_NP_111-F.webp"],
    brand: { "@type": "Brand", name: "Nintendo" },
    offers: { "@type": "Offer", price: 289.9, priceCurrency: "BRL" },
  })}</script>
  <h1 class="ui-pdp-title">título do h1</h1>
  <table><tbody>
    <tr><th>Marca</th><td>Nintendo</td></tr>
    <tr><th>Modelo</th><td>Tears of the Kingdom</td></tr>
    <tr><th>Cor principal</th><td>Colorido</td></tr>
    <tr><th>Peso</th><td>100 g</td></tr>
  </tbody></table>`;

// Sem JSON-LD: tudo vem do HTML. Preço com milhar ("1.234") e centavos separados, como na página.
const DOM_PAGE = `
  <meta property="og:title" content="Geladeira Frost Free | Mercado Livre">
  <meta property="og:image" content="https://http2.mlstatic.com/D_NQ_NP_222-O.webp">
  <h1 class="ui-pdp-title">Geladeira Frost Free 375 L</h1>
  <div class="ui-pdp-price">
    <span class="andes-money-amount andes-money-amount--previous"><span class="andes-money-amount__fraction">5.999</span></span>
    <div class="ui-pdp-price__second-line">
      <span class="andes-money-amount"><span class="andes-money-amount__fraction">4.321</span><span class="andes-money-amount__cents">56</span></span>
    </div>
  </div>
  <table><tr><th>Voltagem</th><td>220V</td></tr><tr><th>Capacidade</th><td>375 L</td></tr></table>`;

// Executa o código do favorito como o navegador faria, capturando a aba que ele abre.
function clickBookmarklet(html: string, href = PAGE) {
  document.head.innerHTML = "";
  document.body.innerHTML = html;
  const opened: string[] = [];
  const alerts: string[] = [];
  const win = { open: (u: string) => (opened.push(u), {}) };
  const run = new Function("document", "location", "window", "alert", buildBookmarklet(ORIGIN).code);
  run(document, { href }, win, (m: string) => alerts.push(m));
  return { opened, alerts };
}

const payloadOf = (openedUrl: string) => parseMeliHash(openedUrl.slice(openedUrl.indexOf("#")));

describe("favorito do Mercado Livre", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
  });

  it("lê JSON-LD: nome, valor, foto (https), especificações e link limpo", () => {
    const { opened, alerts } = clickBookmarklet(LD_PAGE);
    expect(alerts).toEqual([]);
    expect(opened).toHaveLength(1);
    expect(opened[0].startsWith(`${ORIGIN}/admin/presentes/novo#ml=`)).toBe(true);
    expect(payloadOf(opened[0])).toEqual({
      name: "Jogo The Legend Of Zelda: Tears Of The Kingdom - Switch - Físico",
      spec: "Marca: Nintendo. Modelo: Tears of the Kingdom. Cor: Colorido.",
      priceCents: 28990,
      imageUrl: "https://http2.mlstatic.com/D_NQ_NP_111-F.webp",
      // sem #polycard…/tracking; mantém o que identifica o anúncio
      url: "https://www.mercadolivre.com.br/jogo-zelda/up/MLBU2296026608?pdp_filters=item_id%3AMLB3592532790",
    });
  });

  it("sem JSON-LD, lê o HTML: preço atual (não o riscado), com milhar e centavos", () => {
    const { opened } = clickBookmarklet(DOM_PAGE);
    expect(payloadOf(opened[0])).toMatchObject({
      name: "Geladeira Frost Free 375 L",
      priceCents: 432156,
      imageUrl: "https://http2.mlstatic.com/D_NQ_NP_222-O.webp",
      spec: "Voltagem: 220V. Capacidade: 375 L.",
    });
  });

  it("usa meta itemprop=price quando existe", () => {
    const { opened } = clickBookmarklet(`<h1>Tábua</h1><meta itemprop="price" content="23.99">`);
    expect(payloadOf(opened[0])).toMatchObject({ name: "Tábua", priceCents: 2399 });
  });

  it("avisa quando a página não é de um produto", () => {
    const { opened, alerts } = clickBookmarklet("<p>nada aqui</p>");
    expect(opened).toHaveLength(0);
    expect(alerts[0]).toContain("Não encontrei os dados do produto");
  });

  it("avisa quando o navegador bloqueia a nova aba", () => {
    document.body.innerHTML = LD_PAGE;
    const alerts: string[] = [];
    new Function("document", "location", "window", "alert", buildBookmarklet(ORIGIN).code)(
      document,
      { href: PAGE },
      { open: () => null },
      (m: string) => alerts.push(m),
    );
    expect(alerts[0]).toContain("bloqueou a nova aba");
  });

  it("gera um endereço javascript: que decodifica para o mesmo código", () => {
    const { code, href } = buildBookmarklet(ORIGIN);
    expect(href.startsWith("javascript:")).toBe(true);
    expect(decodeURIComponent(href.slice("javascript:".length))).toBe(code);
    expect(code).toContain(JSON.stringify(ORIGIN));
  });
});

describe("parseMeliHash", () => {
  const hash = (data: unknown) => `#ml=${encodeURIComponent(JSON.stringify(data))}`;

  it("aceita dados válidos e normaliza", () => {
    expect(
      parseMeliHash(hash({ name: "  Panela ", spec: "Marca: X.", priceCents: 17722, imageUrl: "https://http2.mlstatic.com/a.jpg", url: "https://www.mercadolivre.com.br/p/MLB1" })),
    ).toEqual({ name: "Panela", spec: "Marca: X.", priceCents: 17722, imageUrl: "https://http2.mlstatic.com/a.jpg", url: "https://www.mercadolivre.com.br/p/MLB1" });
  });

  it("descarta foto fora do CDN do ML, link de outro site e valores inválidos", () => {
    const out = parseMeliHash(hash({ name: "X", imageUrl: "https://evil.com/a.jpg", url: "https://evil.com/x", priceCents: -5 }));
    expect(out).toMatchObject({ imageUrl: null, url: null, priceCents: 0 });
    expect(parseMeliHash(hash({ name: "X", imageUrl: "http://http2.mlstatic.com/a.jpg", priceCents: 12.5 }))).toMatchObject({
      imageUrl: null,
      priceCents: 0,
    });
  });

  it("ignora o que não for do favorito", () => {
    for (const bad of ["", "#outra=1", "#ml=", "#ml=%7Bquebrado", hash({ spec: "sem nome" }), hash("texto"), hash(null)]) {
      expect(parseMeliHash(bad)).toBeNull();
    }
  });

  it("corta textos longos", () => {
    const out = parseMeliHash(hash({ name: "n".repeat(500), spec: "s".repeat(5000) }))!;
    expect(out.name).toHaveLength(200);
    expect(out.spec).toHaveLength(1000);
  });
});
