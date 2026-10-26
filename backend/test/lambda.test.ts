// Exercita o app através do serverless-http, como na Netlify Function (corpo chega no evento).
import bcrypt from "bcryptjs";
import serverless from "serverless-http";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { parseAdminUsers } from "../src/env.js";
import { createFakeRepo } from "./fakeRepo.js";

const PASSWORD = "senha-forte-123";
let handler: ReturnType<typeof serverless>;
let fake: ReturnType<typeof createFakeRepo>;

beforeAll(async () => {
  fake = createFakeRepo([{ slug: "panela", name: "Panela", priceCents: 17722 }]);
  const app = createApp({
    repo: fake.repo,
    config: {
      jwtSecret: "test-secret-with-at-least-32-characters!!",
      admins: parseAdminUsers(`a@example.com:${await bcrypt.hash(PASSWORD, 4)}`),
    },
  });
  handler = serverless(app);
});

type LambdaResult = { statusCode: number; body: string };

function invoke(event: Record<string, unknown>) {
  return handler(
    { httpMethod: "GET", headers: {}, isBase64Encoded: false, ...event },
    {},
  ) as Promise<LambdaResult>;
}

describe("via Netlify Function (serverless-http)", () => {
  it("lê corpo JSON pelo caminho redirecionado /api", async () => {
    const res = await invoke({
      httpMethod: "POST",
      path: "/api/auth/login",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@example.com", password: PASSWORD }),
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).token).toBeTruthy();
  });

  it("lê corpo JSON pelo caminho direto da function e corpo em base64", async () => {
    const res = await invoke({
      httpMethod: "POST",
      path: "/.netlify/functions/api/products/panela/contributions",
      headers: { "content-type": "application/json" },
      body: Buffer.from(JSON.stringify({ guestName: "Ana", mode: "levar" })).toString("base64"),
      isBase64Encoded: true,
    });
    expect(res.statusCode).toBe(201);
  });

  it("devolve 400 para JSON inválido", async () => {
    const res = await invoke({
      httpMethod: "POST",
      path: "/api/auth/login",
      headers: { "content-type": "application/json" },
      body: "{nao-e-json",
    });
    expect(res.statusCode).toBe(400);
  });

  it("aceita upload multipart vindo no evento", async () => {
    const login = await invoke({
      httpMethod: "POST",
      path: "/api/auth/login",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "a@example.com", password: PASSWORD }),
    });
    const { token } = JSON.parse(login.body);

    const form = new FormData();
    form.set("kind", "item");
    form.set("room", "Sala");
    form.set("name", "Abajur");
    form.set("priceCents", "8000");
    form.set("image", new Blob([Buffer.from("fake-png")], { type: "image/png" }), "a.png");
    const encoded = new Response(form);
    const contentType = encoded.headers.get("content-type")!;
    const body = Buffer.from(await encoded.arrayBuffer());

    const res = await invoke({
      httpMethod: "POST",
      path: "/api/admin/products",
      headers: { "content-type": contentType, authorization: `Bearer ${token}` },
      body: body.toString("base64"),
      isBase64Encoded: true,
    });
    expect(res.statusCode).toBe(201);
    const { product } = JSON.parse(res.body);
    expect(product.slug).toBe("abajur");
    expect(fake.images.get(product.imagePath)?.bytes.toString()).toBe("fake-png");
  });
});
