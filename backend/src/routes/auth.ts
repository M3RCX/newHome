import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import type { AppConfig } from "../env.js";
import { HttpError } from "../errors.js";
import { requireAdmin, signAdminToken } from "../middleware/auth.js";
import { limiter } from "../middleware/rateLimit.js";

const loginBody = z.object({
  email: z.string().trim().toLowerCase().max(200),
  password: z.string().min(1).max(200),
});

// Compara com um hash qualquer quando o e-mail não existe, para o tempo de resposta não revelar quem é admin.
let dummyHash: string | undefined;
const getDummyHash = () => (dummyHash ??= bcrypt.hashSync("not-an-admin", 10));

export function authRouter(config: AppConfig) {
  const router = Router();

  router.post("/login", limiter(1, 5), async (req, res) => {
    const { email, password } = loginBody.parse(req.body);
    const admin = config.admins.find((a) => a.email === email);
    const ok = await bcrypt.compare(password, admin?.hash ?? getDummyHash());
    if (!admin || !ok) throw new HttpError(401, "invalid_credentials");
    res.json({ email: admin.email, ...signAdminToken(admin.email, config.jwtSecret) });
  });

  // O dashboard usa para validar o token salvo.
  router.get("/me", requireAdmin(config.jwtSecret), (_req, res) => {
    res.json({ email: res.locals.admin.sub });
  });

  return router;
}
