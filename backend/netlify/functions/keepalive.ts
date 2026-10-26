// Scheduled function: uma consulta por dia para o Supabase free não pausar o projeto por inatividade.
import { createSupabaseRepo } from "../../src/repo.js";

export default async () => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase não configurado");
  await createSupabaseRepo(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).ping();
  console.log("keepalive ok");
};

export const config = { schedule: "@daily" };
