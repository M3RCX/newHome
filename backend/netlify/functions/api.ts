// Placeholder da Fase 0 — substituído pelo Express (serverless-http) na Fase 2.
// O roteamento /api/* → esta function fica no netlify.toml.
export default async (req: Request) => {
  const path = new URL(req.url).pathname.replace(/^\/(\.netlify\/functions\/)?api/, "");
  if (path === "/health") {
    return Response.json({ ok: true });
  }
  return Response.json({ error: "not_found" }, { status: 404 });
};
