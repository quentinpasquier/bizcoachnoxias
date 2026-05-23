import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseUrl,
  getSupabaseServiceRoleKey,
  hasServiceRoleKey,
} from "./env";

// Client Supabase avec service-role : contourne RLS. À n'utiliser QUE côté
// serveur (route handlers / server actions) et UNIQUEMENT après avoir vérifié
// que le user courant est platform_admin. Ne jamais exposer côté client.
export function createServiceClient() {
  if (!hasServiceRoleKey()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY manquante. Indispensable pour le back-office admin.",
    );
  }
  return createSupabaseClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
