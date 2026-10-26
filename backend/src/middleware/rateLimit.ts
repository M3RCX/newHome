import { rateLimit } from "express-rate-limit";

// Memória por instância da function: protege contra abuso simples, não é um limite global.
export function limiter(windowMinutes: number, limit: number) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    // Na Netlify o IP real do cliente vem neste header.
    keyGenerator: (req) => String(req.headers["x-nf-client-connection-ip"] ?? req.ip ?? "unknown"),
    validate: false,
    handler: (_req, res) => {
      res.status(429).json({ error: "too_many_requests" });
    },
  });
}
