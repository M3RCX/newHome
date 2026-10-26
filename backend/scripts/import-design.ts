// T1.3 — Importa os presentes do design (HTML do artifact) para o Supabase.
// Uso: npm run import:design [-- --check]
// Idempotente: faz upsert por slug e sobrescreve as imagens no bucket.
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const envFile = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

type DesignGift = {
  id: string;
  kind: "item" | "cota";
  room: string;
  name: string;
  spec?: string;
  price: number;
  link?: string;
  img?: string;
  status?: string;
  by?: string;
};

const BUCKET = "products";
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const htmlPath = args.find((a) => !a.startsWith("--"));
if (!htmlPath) throw new Error("Informe o caminho do HTML do design.");

const html = await readFile(htmlPath, "utf8");
const match = html.match(/<script type="application\/json" id="data">([\s\S]*?)<\/script>/);
if (!match) throw new Error('Bloco <script id="data"> não encontrado no HTML.');
const gifts: DesignGift[] = JSON.parse(match[1]).gifts;

function decodeImage(dataUri: string) {
  const m = dataUri.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m || !EXT[m[1]]) return null;
  return { contentType: m[1], ext: EXT[m[1]], bytes: Buffer.from(m[2], "base64") };
}

const withImage = gifts.filter((g) => g.img && decodeImage(g.img)).length;
const taken = gifts.filter((g) => g.status && g.status !== "livre");
console.log(
  `${gifts.length} presentes (${gifts.filter((g) => g.kind === "item").length} itens, ` +
    `${gifts.filter((g) => g.kind === "cota").length} vales), ${withImage} com foto.`,
);
if (taken.length) {
  // Contribuições não são importadas: lance-as pelo dashboard.
  console.warn(`Atenção: ${taken.length} já escolhidos no design (não importados): ${taken.map((g) => g.id).join(", ")}`);
}
if (checkOnly) process.exit(0);

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env da raiz.");
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const rows = [];
for (const [index, gift] of gifts.entries()) {
  const slug = gift.id.toLowerCase();
  let image_path: string | null = null;

  const image = gift.img ? decodeImage(gift.img) : null;
  if (image) {
    image_path = `${slug}.${image.ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(image_path, image.bytes, { contentType: image.contentType, upsert: true });
    if (error) throw new Error(`Falha ao enviar a foto de ${slug}: ${error.message}`);
  }

  rows.push({
    slug,
    kind: gift.kind,
    room: gift.room,
    name: gift.name.trim(),
    spec: gift.spec?.trim() ?? "",
    price_cents: Math.round((gift.price || 0) * 100),
    purchase_url: gift.link?.trim() || null,
    image_path,
    sort_order: index,
  });
  process.stdout.write(`\r${index + 1}/${gifts.length}`);
}

const { error } = await supabase.from("products").upsert(rows, { onConflict: "slug" });
if (error) throw new Error(`Falha no upsert dos produtos: ${error.message}`);
console.log(`\n${rows.length} produtos importados.`);
