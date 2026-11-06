// API Express rodando como Netlify Function. O roteamento /api/* → aqui fica no netlify.toml.
import serverless from "serverless-http";
import { createApp } from "../../src/app.js";
import { loadEnv } from "../../src/env.js";
import { createSupabaseRepo } from "../../src/repo.js";
import { createMeli } from "../../src/services/meli.js";

const env = loadEnv();
const app = createApp({
  repo: createSupabaseRepo(env.supabaseUrl, env.supabaseServiceRoleKey),
  config: env.config,
  meli: createMeli(env.meli),
});

export const handler = serverless(app);
