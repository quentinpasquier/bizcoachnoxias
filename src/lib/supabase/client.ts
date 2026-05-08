"use client";

import { createBrowserClient } from "@supabase/ssr";
import {
  getSupabaseUrlOrPlaceholder,
  getSupabaseAnonKeyOrPlaceholder,
} from "./env";

export function createClient() {
  return createBrowserClient(
    getSupabaseUrlOrPlaceholder(),
    getSupabaseAnonKeyOrPlaceholder(),
  );
}
