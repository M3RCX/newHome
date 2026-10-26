import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { AppConfig } from "../src/env.js";
import { parseAdminUsers } from "../src/env.js";
import { slugify } from "../src/routes/adminProducts.js";
import { createFakeRepo } from "./fakeRepo.js";

const ADMIN_EMAIL = "leticia@example.com";
const ADMIN_PASSWORD = "senha-forte-123";
const JWT_SECRET = "test-secret-with-at-least-32-characters!!";

let config: AppConfig;
let fake: ReturnType<typeof createFakeRepo>;
let app: ReturnType<typeof createApp>;

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

beforeAll(async () => {
  config = {
    jwtSecret: JWT_SECRET,
    admins: parseAdminUsers(`${ADMIN_EMAIL}:${await bcrypt.hash(ADMIN_PASSWORD, 4)}`),
  };
});

beforeEach(() => {
  fake = createFakeRepo([
    { slug: "panela", name: "Panela", priceCents: 17722 },
    { slug: "sofa", name: "Sofá", priceCents: 250000 },
    { slug: "vale-sofa", kind: "cota", room: "Cotas", name: "Cota sofá", priceCents: 22000 },
    { slug: "vale-livre", kind: "cota", room: "Cotas", name: "Vale livre", priceCents: 0 },
  ]);
  app = createApp({ repo: fake.repo, config });
});

async function login() {
  const res = await request(app).post("/api/auth/login").send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  expect(res.status).toBe(200);
  return `Bearer ${res.body.token}`;
}

describe("health e roteamento", () => {
  it("responde health nos dois prefixos da Netlify", async () => {
    await request(app).get("/api/health").expect(200, { ok: true });
    await request(app).get("/.netlify/functions/api/health").expect(200, { ok: true });
  });

  it("devolve 503 quando o banco falha", async () => {
    fake.setHealthy(false);
    await request(app).get("/api/health").expect(503);
  });

  it("devolve 404 em rota desconhecida", async () => {
    await request(app).get("/api/nao-existe").expect(404, { error: "not_found" });
  });
});

describe("rotas públicas", () => {
  it("lista produtos sem dados de quem presenteou", async () => {
    await fake.repo.createContribution("panela", { guestName: "Ana", mode: "levar" });
    const res = await request(app).get("/api/products").expect(200);
    const panela = res.body.products.find((p: { slug: string }) => p.slug === "panela");
    expect(panela.status).toBe("escolhido");
    const json = JSON.stringify(res.body);
    expect(json).not.toContain("Ana");
    expect(json).not.toMatch(/guestName|contributions|"mode"|"id"/);
  });

  it("reserva um item e recusa a segunda reserva com 409", async () => {
    await request(app)
      .post("/api/products/panela/contributions")
      .send({ guestName: "Ana", mode: "pix" })
      .expect(201, { slug: "panela", mode: "pix", amountCents: 17722 });
    await request(app)
      .post("/api/products/panela/contributions")
      .send({ guestName: "Bia", mode: "levar" })
      .expect(409, { error: "already_chosen" });
  });

  it("aceita várias partes e vales repetidos", async () => {
    for (const name of ["Caio", "Duda"]) {
      await request(app)
        .post("/api/products/sofa/contributions")
        .send({ guestName: name, mode: "parte", amountCents: 5000 })
        .expect(201);
      await request(app).post("/api/products/vale-sofa/contributions").send({ guestName: name, mode: "pix" }).expect(201);
    }
    expect(fake.contributions).toHaveLength(4);
  });

  it("exige valor em vale de valor livre", async () => {
    await request(app)
      .post("/api/products/vale-livre/contributions")
      .send({ guestName: "Eva", mode: "pix" })
      .expect(400, { error: "invalid_amount" });
  });

  it("valida o corpo e o slug", async () => {
    const res = await request(app).post("/api/products/panela/contributions").send({ guestName: "", mode: "x" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_body");
    await request(app)
      .post("/api/products/NAO_EXISTE/contributions")
      .send({ guestName: "Ana", mode: "pix" })
      .expect(404);
    await request(app)
      .post("/api/products/nao-existe/contributions")
      .send({ guestName: "Ana", mode: "pix" })
      .expect(404, { error: "product_not_found" });
  });

  it("limita reservas por IP", async () => {
    let last = 0;
    for (let i = 0; i < 11; i++) {
      last = (await request(app).post("/api/products/vale-sofa/contributions").send({ guestName: `G${i}`, mode: "pix" }))
        .status;
    }
    expect(last).toBe(429);
  });
});

describe("autenticação", () => {
  it("recusa senha errada e e-mail desconhecido", async () => {
    await request(app)
      .post("/api/auth/login")
      .send({ email: ADMIN_EMAIL, password: "errada" })
      .expect(401, { error: "invalid_credentials" });
    await request(app)
      .post("/api/auth/login")
      .send({ email: "outra@example.com", password: ADMIN_PASSWORD })
      .expect(401, { error: "invalid_credentials" });
  });

  it("emite token válido e aceita e-mail com maiúsculas", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "  Leticia@Example.com ", password: ADMIN_PASSWORD })
      .expect(200);
    expect(res.body.email).toBe(ADMIN_EMAIL);
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    await request(app).get("/api/auth/me").set("Authorization", `Bearer ${res.body.token}`).expect(200, {
      email: ADMIN_EMAIL,
    });
  });

  it.each(["/api/admin/products", "/api/admin/contributions", "/api/admin/summary", "/api/auth/me"])(
    "bloqueia %s sem token, com token inválido ou de outro segredo",
    async (path) => {
      await request(app).get(path).expect(401, { error: "unauthorized" });
      await request(app).get(path).set("Authorization", "Bearer abc.def.ghi").expect(401);
      const forged = jwt.sign({ role: "admin" }, "outro-segredo-qualquer-com-32-chars!!", { subject: ADMIN_EMAIL });
      await request(app).get(path).set("Authorization", `Bearer ${forged}`).expect(401);
      const notAdmin = jwt.sign({ role: "guest" }, JWT_SECRET, { subject: ADMIN_EMAIL });
      await request(app).get(path).set("Authorization", `Bearer ${notAdmin}`).expect(401);
    },
  );
});

describe("admin: produtos", () => {
  it("lista com contribuições e nomes", async () => {
    await fake.repo.createContribution("panela", { guestName: "Ana", mode: "levar" });
    const res = await request(app).get("/api/admin/products").set("Authorization", await login()).expect(200);
    const panela = res.body.products.find((p: { slug: string }) => p.slug === "panela");
    expect(panela.contributions[0]).toMatchObject({ guestName: "Ana", mode: "levar", amountCents: 17722 });
  });

  it("cria por JSON com slug gerado e ordem no fim", async () => {
    const res = await request(app)
      .post("/api/admin/products")
      .set("Authorization", await login())
      .send({ kind: "item", room: "Sala", name: "Luminária de Chão", priceCents: 19990, purchaseUrl: "" })
      .expect(201);
    expect(res.body.product).toMatchObject({ slug: "luminaria-de-chao", sortOrder: 4, purchaseUrl: null });
  });

  it("gera slug com sufixo quando o nome já existe", async () => {
    const auth = await login();
    const body = { kind: "item", room: "Cozinha", name: "Panela", priceCents: 100 };
    const res = await request(app).post("/api/admin/products").set("Authorization", auth).send(body).expect(201);
    expect(res.body.product.slug).toMatch(/^panela-[0-9a-f]{4}$/);
    await request(app)
      .post("/api/admin/products")
      .set("Authorization", auth)
      .send({ ...body, slug: "panela" })
      .expect(409, { error: "slug_taken" });
  });

  it("cria por multipart com foto e força room de vale", async () => {
    const res = await request(app)
      .post("/api/admin/products")
      .set("Authorization", await login())
      .field("kind", "cota")
      .field("room", "Sala")
      .field("name", "Vale jantar")
      .field("priceCents", "15000")
      .attach("image", PNG, { filename: "foto.png", contentType: "image/png" })
      .expect(201);
    expect(res.body.product.room).toBe("Cotas");
    expect(res.body.product.imagePath).toMatch(/^vale-jantar-[a-z0-9]+\.png$/);
    expect(res.body.product.imageUrl).toContain(res.body.product.imagePath);
    expect(fake.images.has(res.body.product.imagePath)).toBe(true);
  });

  it("recusa tipo de imagem inválido e corpo inválido", async () => {
    const auth = await login();
    await request(app)
      .post("/api/admin/products")
      .set("Authorization", auth)
      .field("kind", "item")
      .field("room", "Sala")
      .field("name", "X")
      .field("priceCents", "100")
      .attach("image", Buffer.from("GIF89a"), { filename: "x.gif", contentType: "image/gif" })
      .expect(400, { error: "invalid_image_type" });
    const res = await request(app)
      .post("/api/admin/products")
      .set("Authorization", auth)
      .send({ kind: "outro", name: "", priceCents: -1 });
    expect(res.status).toBe(400);
    expect(res.body.issues.map((i: { path: string }) => i.path)).toEqual(
      expect.arrayContaining(["kind", "room", "name", "priceCents"]),
    );
  });

  it("atualiza, troca a foto e apaga a antiga", async () => {
    const auth = await login();
    const created = await request(app)
      .post("/api/admin/products")
      .set("Authorization", auth)
      .field("kind", "item")
      .field("room", "Sala")
      .field("name", "Quadro")
      .field("priceCents", "5000")
      .attach("image", PNG, { filename: "a.png", contentType: "image/png" });
    const { id, imagePath: oldPath } = created.body.product;

    const updated = await request(app)
      .put(`/api/admin/products/${id}`)
      .set("Authorization", auth)
      .field("priceCents", "6000")
      .attach("image", PNG, { filename: "b.png", contentType: "image/png" })
      .expect(200);
    expect(updated.body.product.priceCents).toBe(6000);
    expect(updated.body.product.imagePath).not.toBe(oldPath);
    expect(fake.images.has(oldPath)).toBe(false);

    const removed = await request(app)
      .put(`/api/admin/products/${id}`)
      .set("Authorization", auth)
      .send({ removeImage: true })
      .expect(200);
    expect(removed.body.product.imagePath).toBeNull();
    expect(fake.images.size).toBe(0);
  });

  it("recusa atualização vazia e id inexistente", async () => {
    const auth = await login();
    const [panela] = await fake.repo.listAdminProducts();
    await request(app).put(`/api/admin/products/${panela.id}`).set("Authorization", auth).send({}).expect(400);
    await request(app)
      .put("/api/admin/products/00000000-0000-4000-8000-000000000000")
      .set("Authorization", auth)
      .send({ name: "X" })
      .expect(404);
    await request(app).get("/api/admin/products/nao-e-uuid").set("Authorization", auth).expect(400);
  });

  it("apaga produto, contribuições e foto", async () => {
    const auth = await login();
    const [panela] = await fake.repo.listAdminProducts();
    await fake.repo.updateProduct(panela.id, { imagePath: "panela.jpg" });
    fake.images.set("panela.jpg", { bytes: PNG, contentType: "image/jpeg" });
    await fake.repo.createContribution("panela", { guestName: "Ana", mode: "levar" });

    await request(app).delete(`/api/admin/products/${panela.id}`).set("Authorization", auth).expect(204);
    expect(fake.products.find((p) => p.id === panela.id)).toBeUndefined();
    expect(fake.contributions).toHaveLength(0);
    expect(fake.images.has("panela.jpg")).toBe(false);
  });
});

describe("admin: contribuições e resumo", () => {
  it("lança manualmente com as regras da reserva", async () => {
    const auth = await login();
    await request(app)
      .post("/api/admin/contributions")
      .set("Authorization", auth)
      .send({ productSlug: "panela", guestName: "Tia Rosa", mode: "levar" })
      .expect(201);
    await request(app)
      .post("/api/admin/contributions")
      .set("Authorization", auth)
      .send({ productSlug: "panela", guestName: "Outra", mode: "pix" })
      .expect(409);
  });

  it("filtra, corrige e remove", async () => {
    const auth = await login();
    const c = await fake.repo.createContribution("vale-sofa", { guestName: "Ana", mode: "pix" });
    await fake.repo.createContribution("panela", { guestName: "Bia", mode: "levar" });

    const list = await request(app)
      .get(`/api/admin/contributions?productId=${c.productId}`)
      .set("Authorization", auth)
      .expect(200);
    expect(list.body.contributions).toHaveLength(1);

    const updated = await request(app)
      .put(`/api/admin/contributions/${c.id}`)
      .set("Authorization", auth)
      .send({ guestName: "Ana Paula", amountCents: 30000 })
      .expect(200);
    expect(updated.body.contribution).toMatchObject({ guestName: "Ana Paula", amountCents: 30000 });

    await request(app).put(`/api/admin/contributions/${c.id}`).set("Authorization", auth).send({}).expect(400);
    await request(app).delete(`/api/admin/contributions/${c.id}`).set("Authorization", auth).expect(204);
    await request(app).delete(`/api/admin/contributions/${c.id}`).set("Authorization", auth).expect(404);
  });

  it("resume escolhidos, valores e vales", async () => {
    await fake.repo.createContribution("panela", { guestName: "Ana", mode: "levar" });
    await fake.repo.createContribution("sofa", { guestName: "Bia", mode: "parte", amountCents: 10000 });
    await fake.repo.createContribution("vale-sofa", { guestName: "Caio", mode: "pix" });
    await fake.repo.createContribution("vale-sofa", { guestName: "Duda", mode: "pix" });

    const res = await request(app).get("/api/admin/summary").set("Authorization", await login()).expect(200);
    expect(res.body).toEqual({
      items: { total: 2, chosen: 1, free: 1 },
      byMode: { levar: 1, pix: 2, parte: 1 },
      pixTotalCents: 10000 + 22000 * 2,
      vales: [{ slug: "vale-sofa", name: "Cota sofá", count: 2, totalCents: 44000 }],
      partes: [{ slug: "sofa", name: "Sofá", count: 1, totalCents: 10000 }],
    });
  });
});

describe("utilitários", () => {
  it("gera slugs sem acento", () => {
    expect(slugify("Caçarola Hércules 21 × 9 cm")).toBe("cacarola-hercules-21-9-cm");
    expect(slugify("!!!")).toBe("presente");
  });

  it("lê ADMIN_USERS com vários admins", () => {
    expect(parseAdminUsers(" A@x.com:$2b$12$abc , b@y.com:$2b$12$def ")).toEqual([
      { email: "a@x.com", hash: "$2b$12$abc" },
      { email: "b@y.com", hash: "$2b$12$def" },
    ]);
    expect(() => parseAdminUsers("sem-hash")).toThrow();
  });

  it("aceita ADMIN_USERS vazio e recusa qualquer login", async () => {
    expect(parseAdminUsers("")).toEqual([]);
    const noAdmins = createApp({ repo: fake.repo, config: { jwtSecret: JWT_SECRET, admins: [] } });
    await request(noAdmins).get("/api/products").expect(200);
    await request(noAdmins)
      .post("/api/auth/login")
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(401);
  });
});
