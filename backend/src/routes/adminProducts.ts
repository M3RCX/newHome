import { randomBytes } from "node:crypto";
import { Router, type Request } from "express";
import multer from "multer";
import { z } from "zod";
import { HttpError } from "../errors.js";
import { getRawBody } from "../rawBody.js";
import type { ProductInput, Repo } from "../repo.js";
import { MAX_AMOUNT_CENTS, SLUG_RE } from "./public.js";

const IMAGE_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // abaixo do limite de ~6 MB das Netlify Functions

// multer 2 aceita streamHandler, mas @types/multer ainda não o declara.
type UploadOptions = multer.Options & {
  streamHandler?: (req: Request, busboy: NodeJS.WritableStream) => void;
};

const uploadOptions: UploadOptions = {
  storage: multer.memoryStorage(),
  // Nas Netlify Functions o corpo já vem lido (ver rawBody.ts).
  streamHandler: (req, busboy) => {
    const raw = getRawBody(req);
    if (raw) busboy.end(raw);
    else req.pipe(busboy);
  },
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_EXT[file.mimetype]) cb(null, true);
    else cb(new HttpError(400, "invalid_image_type"));
  },
};

const upload = multer(uploadOptions);

// Campos chegam como texto no multipart ou tipados no JSON.
const boolField = z.union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")]);

const productFields = z.object({
  slug: z.string().trim().toLowerCase().max(60).regex(SLUG_RE, "slug inválido"),
  kind: z.enum(["item", "cota"]),
  room: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  spec: z.string().trim().max(1000),
  priceCents: z.coerce.number().int().min(0).max(MAX_AMOUNT_CENTS),
  purchaseUrl: z
    .union([z.url().max(1000), z.literal("")])
    .nullable()
    .transform((v) => v || null),
  sortOrder: z.coerce.number().int(),
  removeImage: boolField,
});

const createBody = productFields
  .omit({ removeImage: true })
  .partial({ slug: true, spec: true, purchaseUrl: true, sortOrder: true });

const updateBody = productFields.partial();

const idParam = z.uuid();

export function slugify(text: string) {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
  return slug || "presente";
}

const imagePathFor = (slug: string, mimetype: string) =>
  `${slug}-${Date.now().toString(36)}.${IMAGE_EXT[mimetype]}`;

export function adminProductsRouter(repo: Repo) {
  const router = Router();

  // Remoção de foto antiga é "melhor esforço": não falha a operação principal.
  const discardImage = (path: string | null | undefined) =>
    path ? repo.removeImage(path).catch((err) => console.warn("Falha ao remover imagem", path, err)) : undefined;

  router.get("/", async (_req, res) => {
    res.json({ products: await repo.listAdminProducts() });
  });

  router.get("/:id", async (req, res) => {
    const product = await repo.getProduct(idParam.parse(req.params.id));
    if (!product) throw new HttpError(404, "product_not_found");
    res.json({ product });
  });

  router.post("/", upload.single("image"), async (req, res) => {
    const body = createBody.parse(req.body ?? {});
    const autoSlug = !body.slug;
    const input: ProductInput = {
      slug: body.slug ?? slugify(body.name),
      kind: body.kind,
      room: body.kind === "cota" ? "Cotas" : body.room,
      name: body.name,
      spec: body.spec ?? "",
      priceCents: body.priceCents,
      purchaseUrl: body.purchaseUrl ?? null,
      imagePath: null,
      sortOrder: body.sortOrder ?? (await repo.nextSortOrder()),
    };

    if (req.file) {
      input.imagePath = imagePathFor(input.slug, req.file.mimetype);
      await repo.uploadImage(input.imagePath, req.file.buffer, req.file.mimetype);
    }

    try {
      let product;
      try {
        product = await repo.insertProduct(input);
      } catch (err) {
        // Slug gerado a partir do nome colidiu: tenta uma vez com sufixo.
        if (!(autoSlug && err instanceof HttpError && err.code === "slug_taken")) throw err;
        product = await repo.insertProduct({ ...input, slug: `${input.slug}-${randomBytes(2).toString("hex")}` });
      }
      res.status(201).json({ product });
    } catch (err) {
      await discardImage(input.imagePath);
      throw err;
    }
  });

  router.put("/:id", upload.single("image"), async (req, res) => {
    const id = idParam.parse(req.params.id);
    const existing = await repo.getProduct(id);
    if (!existing) throw new HttpError(404, "product_not_found");

    const { removeImage, ...fields } = updateBody.parse(req.body ?? {});
    const patch: Partial<ProductInput> = { ...fields };
    if ((fields.kind ?? existing.kind) === "cota") patch.room = "Cotas";

    if (req.file) {
      patch.imagePath = imagePathFor(fields.slug ?? existing.slug, req.file.mimetype);
      await repo.uploadImage(patch.imagePath, req.file.buffer, req.file.mimetype);
    } else if (removeImage) {
      patch.imagePath = null;
    }

    if (Object.keys(patch).length === 0) throw new HttpError(400, "empty_update");

    let product;
    try {
      product = await repo.updateProduct(id, patch);
    } catch (err) {
      if (req.file) await discardImage(patch.imagePath);
      throw err;
    }
    if (patch.imagePath !== undefined && existing.imagePath !== patch.imagePath) {
      await discardImage(existing.imagePath);
    }
    res.json({ product });
  });

  router.delete("/:id", async (req, res) => {
    const id = idParam.parse(req.params.id);
    const existing = await repo.getProduct(id);
    if (!existing) throw new HttpError(404, "product_not_found");
    await repo.deleteProduct(id);
    await discardImage(existing.imagePath);
    res.status(204).end();
  });

  return router;
}
