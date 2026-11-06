import { Router } from "express";
import { z } from "zod";
import { limiter } from "../middleware/rateLimit.js";
import type { Meli } from "../services/meli.js";

const body = z.object({ url: z.string().trim().min(1).max(1000) });

// Lê o link de um produto (Mercado Livre) e devolve os campos para pré-preencher o formulário.
export function adminPreviewRouter(meli: Meli) {
  const router = Router();
  router.post("/", limiter(1, 30), async (req, res) => {
    const { url } = body.parse(req.body);
    res.json(await meli.preview(url));
  });
  return router;
}
