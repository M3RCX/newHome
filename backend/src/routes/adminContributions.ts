import { Router } from "express";
import { z } from "zod";
import type { Repo } from "../repo.js";
import { MAX_AMOUNT_CENTS, SLUG_RE } from "./public.js";

const mode = z.enum(["levar", "pix", "parte"]);
const guestName = z.string().trim().min(1).max(80);
const amountCents = z.number().int().min(0).max(MAX_AMOUNT_CENTS);

// Lançamento manual segue as mesmas regras da reserva pública (RPC).
const createBody = z.object({
  productSlug: z.string().regex(SLUG_RE),
  guestName,
  mode,
  amountCents: amountCents.positive().optional(),
});

// Correção direta pelo admin: sem as regras da reserva.
const updateBody = z
  .object({ guestName, mode, amountCents })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "nada para atualizar");

const listQuery = z.object({ productId: z.uuid().optional() });
const idParam = z.uuid();

export function adminContributionsRouter(repo: Repo) {
  const router = Router();

  router.get("/", async (req, res) => {
    const { productId } = listQuery.parse(req.query);
    res.json({ contributions: await repo.listContributions(productId) });
  });

  router.post("/", async (req, res) => {
    const { productSlug, ...input } = createBody.parse(req.body);
    res.status(201).json({ contribution: await repo.createContribution(productSlug, input) });
  });

  router.put("/:id", async (req, res) => {
    const contribution = await repo.updateContribution(idParam.parse(req.params.id), updateBody.parse(req.body));
    res.json({ contribution });
  });

  router.delete("/:id", async (req, res) => {
    await repo.deleteContribution(idParam.parse(req.params.id));
    res.status(204).end();
  });

  return router;
}

export function summaryRouter(repo: Repo) {
  const router = Router();

  router.get("/", async (_req, res) => {
    const products = await repo.listAdminProducts();
    const items = products.filter((p) => p.kind === "item");
    const contributions = products.flatMap((p) => p.contributions);
    const totalOf = (list: { amountCents: number }[]) => list.reduce((sum, c) => sum + c.amountCents, 0);

    const grouped = (kindFilter: (p: (typeof products)[number]) => boolean, modeFilter: (m: string) => boolean) =>
      products
        .filter(kindFilter)
        .map((p) => {
          const list = p.contributions.filter((c) => modeFilter(c.mode));
          return { slug: p.slug, name: p.name, count: list.length, totalCents: totalOf(list) };
        })
        .filter((g) => g.count > 0);

    res.json({
      items: {
        total: items.length,
        chosen: items.filter((p) => p.status === "escolhido").length,
        free: items.filter((p) => p.status === "livre").length,
      },
      byMode: {
        levar: contributions.filter((c) => c.mode === "levar").length,
        pix: contributions.filter((c) => c.mode === "pix").length,
        parte: contributions.filter((c) => c.mode === "parte").length,
      },
      // Valor esperado em Pix (pix + partes). "levar" não entra.
      pixTotalCents: totalOf(contributions.filter((c) => c.mode !== "levar")),
      vales: grouped((p) => p.kind === "cota", () => true),
      partes: grouped((p) => p.kind === "item", (m) => m === "parte"),
    });
  });

  return router;
}
