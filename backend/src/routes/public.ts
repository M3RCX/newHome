import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../errors.js";
import { limiter } from "../middleware/rateLimit.js";
import type { Repo } from "../repo.js";

export const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
export const MAX_AMOUNT_CENTS = 10_000_000; // R$ 100 mil

const contributionBody = z.object({
  guestName: z.string().trim().min(1).max(80),
  mode: z.enum(["levar", "pix", "parte"]),
  amountCents: z.number().int().positive().max(MAX_AMOUNT_CENTS).optional(),
});

export function publicRouter(repo: Repo) {
  const router = Router();

  // Lista pública: só status, nunca quem presenteou nem o modo.
  router.get("/", async (_req, res) => {
    const products = await repo.listPublicProducts();
    res.set("Cache-Control", "no-store").json({ products });
  });

  router.post("/:slug/contributions", limiter(10, 10), async (req, res) => {
    const slug = String(req.params.slug);
    if (!SLUG_RE.test(slug)) throw new HttpError(404, "product_not_found");
    const body = contributionBody.parse(req.body);
    const contribution = await repo.createContribution(slug, body);
    res.status(201).json({ slug, mode: contribution.mode, amountCents: contribution.amountCents });
  });

  return router;
}
