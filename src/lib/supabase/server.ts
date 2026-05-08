import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  getSupabaseUrlOrPlaceholder,
  getSupabaseAnonKeyOrPlaceholder,
} from "./env";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    getSupabaseUrlOrPlaceholder(),
    getSupabaseAnonKeyOrPlaceholder(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: CookieOptions }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components ne peuvent pas écrire les cookies. le middleware s'en charge.
          }
        },
      },
    },
  );
}
