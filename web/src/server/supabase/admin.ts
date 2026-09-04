import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireServerEnv, requireSupabaseUrl } from "./env";

let adminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  adminClient = createClient(
    requireSupabaseUrl(),
    requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );

  return adminClient;
}
