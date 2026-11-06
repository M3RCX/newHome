import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import multer from "multer";
import { ZodError } from "zod";
import type { AppConfig } from "./env.js";
import { HttpError } from "./errors.js";
import { requireAdmin } from "./middleware/auth.js";
import { captureRawBody, jsonFromRawBody } from "./rawBody.js";
import type { Repo } from "./repo.js";
import { createMeli, type Meli } from "./services/meli.js";
import { adminContributionsRouter, summaryRouter } from "./routes/adminContributions.js";
import { adminPreviewRouter } from "./routes/adminPreview.js";
import { adminProductsRouter } from "./routes/adminProducts.js";
import { authRouter } from "./routes/auth.js";
import { publicRouter } from "./routes/public.js";

export type AppDeps = { repo: Repo; config: AppConfig; meli?: Meli };

const JSON_LIMIT_BYTES = 50 * 1024;

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code });
  } else if (err instanceof ZodError) {
    res.status(400).json({
      error: "invalid_body",
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  } else if (err instanceof multer.MulterError) {
    res
      .status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400)
      .json({ error: err.code === "LIMIT_FILE_SIZE" ? "image_too_large" : "invalid_upload" });
  } else if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: "invalid_json" });
  } else if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "body_too_large" });
  } else {
    console.error(err);
    res.status(500).json({ error: "internal_error" });
  }
};

export function createApp({ repo, config, meli = createMeli(null) }: AppDeps) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(captureRawBody);
  app.use(express.json({ limit: JSON_LIMIT_BYTES }));
  app.use(jsonFromRawBody(JSON_LIMIT_BYTES));

  const api = express.Router();

  api.get("/health", async (_req, res) => {
    try {
      await repo.ping();
      res.set("Cache-Control", "no-store").json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(503).json({ ok: false });
    }
  });

  api.use("/auth", authRouter(config));
  api.use("/products", publicRouter(repo));

  const admin = express.Router();
  admin.use(requireAdmin(config.jwtSecret));
  admin.use("/products", adminProductsRouter(repo, meli));
  admin.use("/product-preview", adminPreviewRouter(meli));
  admin.use("/contributions", adminContributionsRouter(repo));
  admin.use("/summary", summaryRouter(repo));
  api.use("/admin", admin);

  api.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  // Pela Netlify a requisição pode chegar como /api/... (redirect) ou /.netlify/functions/api/...
  app.use(["/api", "/.netlify/functions/api"], api);
  app.use(errorHandler);
  return app;
}
