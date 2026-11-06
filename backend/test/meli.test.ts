import bcrypt from "bcryptjs";
import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { parseAdminUsers } from "../src/env.js";
import { HttpError } from "../src/errors.js";
import { createMeli, parseMeliUrl, slugToName, type Meli } from "../src/services/meli.js";
import { createFakeRepo } from "./fakeRepo.js";

const CREDS = { clientId: "123", clientSecret: "secret" };
const ITEM_URL =
  "https://www.mercadolivre.com.br/panela-de-pressao-45l-tramontina-vancouver-effect-20591-720-cor-vermelho/p/MLB42501702?pdp_filters=item_id%3AMLB5456370676";

const item = {
  id: "MLB5456370676",
  title: "Panela De Pressão Tramontina Vancouver Effect 4,5 L",
  price: 177.22,
  thumbnail: "http://http2.mlstatic.com/D_thumb-I.jpg",
  pictures: [{ url: "http://http2.mlstatic.com/D_1-F.jpg", secure_url: "https://http2.mlstatic.com/D_1-F.webp" }],
  attributes: [
    { id: "BRAND", value_name: "Tramontina" },
    { id: "MODEL", value_name: "Vancouver Effect" },
    { id: "COLOR", value_name: "Vermelho" },
    { id: "MAIN_COLOR", value_name: "Vermelho" },
    { id: "CAPACITY", value_name: null },
  ],
};

const catalog = {
  id: "MLB42501702",
  name: "Panela de Pressão Vancouver Effect 4,5 L",
  pictures: [{ url: "https://http2.mlstatic.com/D_cat-F.jpg" }],
  attributes: [{ id: "BRAND", value_name: "Tramontina" }],
  buy_box_winner: { price: 199.9 },
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

// fetch simulado: roteia por caminho e conta as chamadas.
function mockApi(routes: Record<string, () => Response>) {
  const calls: string[] = [];
  const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url.replace("https://api.mercadolibre.com", ""));
    const key = Object.keys(routes).find((k) => url.endsWith(k));
    return key ? routes[key]() : json({ message: "nope" }, 404);
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, calls };
}
const token = () => json({ access_token: "tok", expires_in: 21600 });

describe("parseMeliUrl", () => {
  it.each([
    [ITEM_URL, { itemId: "MLB5456370676", productId: "MLB42501702" }],
    [
      "https://www.mercadolivre.com.br/forma-de-pudim-e-bolo-de-aluminio-26cm/up/MLBU1964201091?pdp_filters=item_id:MLB1992614841",
      { itemId: "MLB1992614841", userProductId: "MLBU1964201091" },
    ],
    ["https://produto.mercadolivre.com.br/MLB-1234567890-jogo-de-facas-inox-_JM", { itemId: "MLB1234567890" }],
    ["https://www.mercadolivre.com.br/tabua-de-corte/p/MLB54015972", { productId: "MLB54015972" }],
    ["https://www.mercadolivre.com.br/tabua-de-corte/p/MLB54015972?wid=MLB4533205377", { itemId: "MLB4533205377" }],
  ])("lê %s", (url, expected) => {
    expect(parseMeliUrl(url)).toMatchObject(expected);
  });

  it("tira o nome do endereço", () => {
    expect(parseMeliUrl(ITEM_URL).slug).toContain("panela-de-pressao");
    expect(parseMeliUrl("https://produto.mercadolivre.com.br/MLB-1234567890-jogo-de-facas-inox-_JM").slug).toBe(
      "jogo-de-facas-inox",
    );
    expect(slugToName("jogo-de-facas-inox")).toBe("Jogo de facas inox");
    expect(slugToName("")).toBe("Presente");
  });

  it.each([
    "não é um link",
    "https://exemplo.com/p/MLB123456",
    "https://mercadolivre.com.br.evil.com/x/p/MLB123456",
    "https://www.mercadolivre.com.br/ofertas",
    "ftp://www.mercadolivre.com.br/x/p/MLB123456",
  ])("recusa %s", (url) => {
    expect(() => parseMeliUrl(url)).toThrow(HttpError);
  });
});

describe("preview", () => {
  it("monta nome, especificação, valor e foto a partir do anúncio", async () => {
    const { fetchFn, calls } = mockApi({ "/oauth/token": token, "/items/MLB5456370676": () => json(item) });
    const meli = createMeli(CREDS, fetchFn);
    const p = await meli.preview(ITEM_URL);
    expect(p).toMatchObject({
      name: "Panela De Pressão Tramontina Vancouver Effect 4,5 L",
      spec: "Marca: Tramontina. Modelo: Vancouver Effect. Cor: Vermelho.",
      priceCents: 17722,
      imageUrl: "https://http2.mlstatic.com/D_1-F.webp",
      purchaseUrl: ITEM_URL,
      source: "api",
      warning: null,
    });
    await meli.preview(ITEM_URL);
    expect(calls.filter((c) => c === "/oauth/token")).toHaveLength(1); // token em cache
  });

  it("usa o catálogo quando o anúncio não existe", async () => {
    const { fetchFn, calls } = mockApi({ "/oauth/token": token, "/products/MLB42501702": () => json(catalog) });
    const p = await createMeli(CREDS, fetchFn).preview(ITEM_URL);
    expect(calls).toContain("/items/MLB5456370676");
    expect(p).toMatchObject({ name: catalog.name, priceCents: 19990, imageUrl: "https://http2.mlstatic.com/D_cat-F.jpg", source: "api" });
  });

  it("se o anúncio for bloqueado (403), tenta o catálogo do mesmo link", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { fetchFn } = mockApi({
      "/oauth/token": token,
      "/items/MLB5456370676": () => json({ error: "access_denied" }, 403),
      "/products/MLB42501702": () => json({ ...catalog, buy_box_winner: null }),
    });
    const p = await createMeli(CREDS, fetchFn).preview(ITEM_URL);
    expect(p).toMatchObject({ source: "api", name: catalog.name, priceCents: null, warning: null });
  });

  it("avisa quando o ML bloqueia o link inteiro (403 sem catálogo)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const up = "https://www.mercadolivre.com.br/jogo-zelda/up/MLBU2296026608?pdp_filters=item_id%3AMLB3592532790";
    const { fetchFn } = mockApi({
      "/oauth/token": token,
      "/items/MLB3592532790": () => json({}, 403),
      "/user-products/MLBU2296026608": () => json({}, 403),
    });
    expect(await createMeli(CREDS, fetchFn).preview(up)).toMatchObject({
      source: "link",
      warning: "meli_restricted",
      name: "Jogo zelda",
    });
  });

  it("renova o token expirado e tenta de novo", async () => {
    let first = true;
    const { fetchFn, calls } = mockApi({
      "/oauth/token": token,
      "/items/MLB5456370676": () => (first ? ((first = false), json({}, 401)) : json(item)),
    });
    const p = await createMeli(CREDS, fetchFn).preview(ITEM_URL);
    expect(p.source).toBe("api");
    expect(calls.filter((c) => c === "/oauth/token")).toHaveLength(2);
  });

  it("sem credenciais devolve só o nome do link, sem chamar a API", async () => {
    const { fetchFn, calls } = mockApi({});
    const p = await createMeli(null, fetchFn).preview(ITEM_URL);
    expect(p).toMatchObject({ source: "link", warning: "meli_not_configured", priceCents: null, imageUrl: null, spec: "" });
    expect(p.name.startsWith("Panela de pressao")).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it("se a API falhar, cai para o nome do link", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const forbidden = mockApi({ "/oauth/token": token, "/items/MLB5456370676": () => json({}, 403) });
    expect(await createMeli(CREDS, forbidden.fetchFn).preview(ITEM_URL)).toMatchObject({
      source: "link",
      warning: "meli_restricted",
    });
    const down = mockApi({ "/oauth/token": token, "/items/MLB5456370676": () => json({}, 500) });
    expect((await createMeli(CREDS, down.fetchFn).preview(ITEM_URL)).warning).toBe("meli_unavailable");
    const badToken = mockApi({ "/oauth/token": () => json({ error: "invalid_client" }, 400) });
    expect((await createMeli(CREDS, badToken.fetchFn).preview(ITEM_URL)).warning).toBe("meli_unavailable");
    const notFound = mockApi({ "/oauth/token": token });
    expect((await createMeli(CREDS, notFound.fetchFn).preview(ITEM_URL)).warning).toBe("meli_not_found");
  });
});

describe("downloadImage", () => {
  const image = (type = "image/jpeg", size = 10, extra: Record<string, string> = {}) =>
    new Response(Buffer.alloc(size, 1), { headers: { "content-type": type, ...extra } });

  it("baixa imagens do CDN do Mercado Livre", async () => {
    const { fetchFn } = mockApi({ "D_1-F.webp": () => image("image/webp") });
    const out = await createMeli(CREDS, fetchFn).downloadImage("https://http2.mlstatic.com/D_1-F.webp");
    expect(out.contentType).toBe("image/webp");
    expect(out.bytes).toHaveLength(10);
  });

  it("recusa outros domínios e http sem baixar nada", async () => {
    const { fetchFn, calls } = mockApi({});
    const meli = createMeli(CREDS, fetchFn);
    for (const url of ["https://evil.com/a.jpg", "https://mlstatic.com.evil.com/a.jpg", "http://http2.mlstatic.com/a.jpg", "x"]) {
      await expect(meli.downloadImage(url)).rejects.toMatchObject({ code: "invalid_image_url" });
    }
    expect(calls).toHaveLength(0);
  });

  it("valida tipo, tamanho e falhas de rede", async () => {
    const meli = (route: () => Response) => createMeli(CREDS, mockApi({ "a.jpg": route }).fetchFn);
    const url = "https://http2.mlstatic.com/a.jpg";
    await expect(meli(() => image("text/html")).downloadImage(url)).rejects.toMatchObject({ code: "invalid_image_type" });
    await expect(meli(() => image("image/jpeg", 5, { "content-length": String(5 * 1024 * 1024) })).downloadImage(url)).rejects.toMatchObject({
      code: "image_too_large",
    });
    await expect(meli(() => image("image/jpeg", 5 * 1024 * 1024)).downloadImage(url)).rejects.toMatchObject({ code: "image_too_large" });
    await expect(meli(() => json({}, 404)).downloadImage(url)).rejects.toMatchObject({ code: "image_download_failed" });
    const boom = createMeli(CREDS, (async () => {
      throw new TypeError("redirect");
    }) as unknown as typeof fetch);
    await expect(boom.downloadImage(url)).rejects.toMatchObject({ status: 502, code: "image_download_failed" });
  });
});

describe("rotas do admin", () => {
  const SECRET = "test-secret-with-at-least-32-characters!!";
  const PASSWORD = "senha-forte-123";
  let config: Parameters<typeof createApp>[0]["config"];
  beforeAll(async () => {
    config = { jwtSecret: SECRET, admins: parseAdminUsers(`a@example.com:${await bcrypt.hash(PASSWORD, 4)}`) };
  });

  const fakeMeli = (): Meli & { downloads: string[] } => {
    const downloads: string[] = [];
    return {
      downloads,
      preview: async (url) => createMeli(null).preview(url),
      downloadImage: async (url) => {
        downloads.push(url);
        if (url.includes("falha")) throw new HttpError(502, "image_download_failed");
        return { bytes: Buffer.from("img-do-ml"), contentType: "image/webp" };
      },
    };
  };

  async function setup() {
    const fake = createFakeRepo([{ slug: "panela", name: "Panela" }]);
    const meli = fakeMeli();
    const app = createApp({ repo: fake.repo, config, meli });
    const login = await request(app).post("/api/auth/login").send({ email: "a@example.com", password: PASSWORD });
    return { fake, meli, app, auth: `Bearer ${login.body.token}` };
  }

  it("product-preview exige login e valida o link", async () => {
    const { app, auth } = await setup();
    await request(app).post("/api/admin/product-preview").send({ url: ITEM_URL }).expect(401);
    await request(app).post("/api/admin/product-preview").set("Authorization", auth).send({ url: "https://exemplo.com" }).expect(400, { error: "invalid_url" });
    const res = await request(app).post("/api/admin/product-preview").set("Authorization", auth).send({ url: ITEM_URL }).expect(200);
    expect(res.body).toMatchObject({ source: "link", warning: "meli_not_configured", purchaseUrl: ITEM_URL });
  });

  it("cria produto com a foto vinda do link", async () => {
    const { app, auth, fake, meli } = await setup();
    const res = await request(app)
      .post("/api/admin/products")
      .set("Authorization", auth)
      .send({ kind: "item", room: "Cozinha", name: "Jogo de facas", priceCents: 11000, imageUrl: "https://http2.mlstatic.com/D_1-F.webp" })
      .expect(201);
    expect(meli.downloads).toEqual(["https://http2.mlstatic.com/D_1-F.webp"]);
    expect(res.body.product.imagePath).toMatch(/^jogo-de-facas-[a-z0-9]+\.webp$/);
    expect(fake.images.get(res.body.product.imagePath)?.bytes.toString()).toBe("img-do-ml");
  });

  it("não cria o produto se a foto do link não baixar", async () => {
    const { app, auth, fake } = await setup();
    await request(app)
      .post("/api/admin/products")
      .set("Authorization", auth)
      .send({ kind: "item", room: "Cozinha", name: "Sem foto", priceCents: 100, imageUrl: "https://http2.mlstatic.com/falha.jpg" })
      .expect(502, { error: "image_download_failed" });
    expect(fake.products.find((p) => p.name === "Sem foto")).toBeUndefined();
  });

  it("arquivo enviado vale mais que a foto do link; update troca e apaga a antiga", async () => {
    const { app, auth, fake, meli } = await setup();
    const created = await request(app)
      .post("/api/admin/products")
      .set("Authorization", auth)
      .field("kind", "item")
      .field("room", "Sala")
      .field("name", "Quadro")
      .field("priceCents", "5000")
      .field("imageUrl", "https://http2.mlstatic.com/a.jpg")
      .attach("image", Buffer.from("meu-arquivo"), { filename: "a.png", contentType: "image/png" })
      .expect(201);
    expect(meli.downloads).toHaveLength(0);
    const { id, imagePath: oldPath } = created.body.product;

    const updated = await request(app)
      .put(`/api/admin/products/${id}`)
      .set("Authorization", auth)
      .send({ imageUrl: "https://http2.mlstatic.com/b.jpg" })
      .expect(200);
    expect(updated.body.product.imagePath).not.toBe(oldPath);
    expect(fake.images.has(oldPath)).toBe(false);
    await request(app).put(`/api/admin/products/${id}`).set("Authorization", auth).send({ imageUrl: "não-é-url" }).expect(400);
  });
});
