import { NextResponse } from "next/server";
import {
  getSupabaseUrl,
  getSupabaseAnonKey,
  isSupabaseConfigured,
} from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

interface CheckResult {
  ok: boolean;
  detail: string;
}

export async function GET() {
  const checks: Record<string, CheckResult> = {};

  const supabaseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? "";

  // 1. Variables d'env présentes ?
  let parsedUrl: URL | null = null;
  if (supabaseUrl) {
    try {
      parsedUrl = new URL(supabaseUrl);
    } catch {
      parsedUrl = null;
    }
  }

  checks.envSupabaseUrl = {
    ok: !!parsedUrl && parsedUrl.pathname === "/" && parsedUrl.host.endsWith(".supabase.co"),
    detail: parsedUrl
      ? `protocol=${parsedUrl.protocol} | host=${parsedUrl.host} | pathname="${parsedUrl.pathname}" | search="${parsedUrl.search}" — ${parsedUrl.pathname !== "/" ? "❌ PATH EN TROP — l'URL doit être uniquement https://xxx.supabase.co sans rien après" : parsedUrl.host.endsWith(".supabase.co") ? "OK" : "host pas en .supabase.co"}`
      : `URL invalide ou vide : "${supabaseUrl}"`,
  };

  checks.envSupabaseAnonKey = anonKey
    ? {
        ok: anonKey.startsWith("eyJ"),
        detail: `défini (longueur ${anonKey.length}, commence par "${anonKey.slice(0, 6)}...")${anonKey.startsWith("eyJ") ? "" : " ⚠️ ne commence pas par eyJ — c'est sûrement pas un JWT Supabase valide"}`,
      }
    : { ok: false, detail: "VIDE" };

  checks.envAnthropicKey = anthropicKey
    ? {
        ok: anthropicKey.startsWith("sk-ant-"),
        detail: `défini (longueur ${anthropicKey.length}, commence par "${anthropicKey.slice(0, 8)}...")`,
      }
    : { ok: false, detail: "VIDE" };

  checks.envAppUrl = process.env.NEXT_PUBLIC_APP_URL
    ? { ok: true, detail: process.env.NEXT_PUBLIC_APP_URL }
    : { ok: false, detail: "non défini (pas bloquant)" };

  checks.isSupabaseConfigured = {
    ok: isSupabaseConfigured(),
    detail: isSupabaseConfigured() ? "vrai" : "faux → mode démo",
  };

  // 2. Tests réseau — uniquement si parsedUrl est OK
  if (parsedUrl && anonKey) {
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;

    // Test 1 : /auth/v1/settings (toujours public, doit renvoyer JSON)
    try {
      const res = await fetch(`${baseUrl}/auth/v1/settings`, {
        headers: { apikey: anonKey },
        cache: "no-store",
      });
      const text = await res.text();
      checks.testAuthSettings = {
        ok: res.ok,
        detail: `HTTP ${res.status} — ${truncate(text, 200)}`,
      };
    } catch (err) {
      checks.testAuthSettings = {
        ok: false,
        detail: `Échec fetch : ${(err as Error).message}`,
      };
    }

    // Test 2 : /rest/v1/ (root PostgREST)
    try {
      const res = await fetch(`${baseUrl}/rest/v1/`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        cache: "no-store",
      });
      const text = await res.text();
      checks.testPostgrestRoot = {
        ok: res.status < 500,
        detail: `HTTP ${res.status} — ${truncate(text, 200)}`,
      };
    } catch (err) {
      checks.testPostgrestRoot = {
        ok: false,
        detail: `Échec fetch : ${(err as Error).message}`,
      };
    }

    // Test 3 : table clients (vérifie que la migration 0002 est passée)
    try {
      const res = await fetch(
        `${baseUrl}/rest/v1/clients?select=id&limit=1`,
        {
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
          cache: "no-store",
        },
      );
      const text = await res.text();
      checks.testClientsTable = {
        ok: res.ok,
        detail: `HTTP ${res.status} — ${truncate(text, 300)} ${res.ok ? "" : " — vérifie que la migration 0002_clients.sql a bien été exécutée dans le SQL Editor Supabase"}`,
      };
    } catch (err) {
      checks.testClientsTable = {
        ok: false,
        detail: `Échec fetch : ${(err as Error).message}`,
      };
    }

    // Test 4 : table profiles (vérifie que la migration 0001 est passée)
    try {
      const res = await fetch(
        `${baseUrl}/rest/v1/profiles?select=id&limit=1`,
        {
          headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
          cache: "no-store",
        },
      );
      const text = await res.text();
      checks.testProfilesTable = {
        ok: res.ok,
        detail: `HTTP ${res.status} — ${truncate(text, 300)} ${res.ok ? "" : " — vérifie que la migration 0001_init.sql a bien été exécutée dans le SQL Editor Supabase"}`,
      };
    } catch (err) {
      checks.testProfilesTable = {
        ok: false,
        detail: `Échec fetch : ${(err as Error).message}`,
      };
    }
  }

  const ok = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    {
      ok,
      mode: isSupabaseConfigured() ? "production" : "demo",
      timestamp: new Date().toISOString(),
      checks,
      hint: ok
        ? "Tout est OK. Tu peux te connecter."
        : "Au moins un check échoue. Regarde 'detail' pour chaque ligne FAUSSE.",
    },
    { status: ok ? 200 : 500 },
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}...` : s;
}
