import { z } from "zod";

export type AdminUser = { email: string; hash: string };

export type AppConfig = {
  jwtSecret: string;
  admins: AdminUser[];
};

const envSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  JWT_SECRET: z.string().min(32, "JWT_SECRET precisa de pelo menos 32 caracteres"),
  // Vazio = nenhum admin: o site público funciona, só o login fica recusado.
  ADMIN_USERS: z.string().default(""),
  // Opcionais: app do Mercado Livre para preencher o produto pelo link (ver README).
  MELI_CLIENT_ID: z.string().default(""),
  MELI_CLIENT_SECRET: z.string().default(""),
});

// ADMIN_USERS=email:bcryptHash,email2:bcryptHash (hash bcrypt não contém ":" nem ",")
export function parseAdminUsers(raw: string): AdminUser[] {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const sep = entry.indexOf(":");
      if (sep < 1) throw new Error("ADMIN_USERS inválido: use email:hash");
      return { email: entry.slice(0, sep).trim().toLowerCase(), hash: entry.slice(sep + 1).trim() };
    });
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env) {
  const env = envSchema.parse(source);
  if (!env.ADMIN_USERS.trim()) console.warn("ADMIN_USERS vazio: ninguém consegue entrar no dashboard.");
  return {
    supabaseUrl: env.SUPABASE_URL,
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    meli:
      env.MELI_CLIENT_ID.trim() && env.MELI_CLIENT_SECRET.trim()
        ? { clientId: env.MELI_CLIENT_ID.trim(), clientSecret: env.MELI_CLIENT_SECRET.trim() }
        : null,
    config: {
      jwtSecret: env.JWT_SECRET,
      admins: parseAdminUsers(env.ADMIN_USERS),
    } satisfies AppConfig,
  };
}
