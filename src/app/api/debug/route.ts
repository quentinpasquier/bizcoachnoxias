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

  // 1. Variables d'env présentes ?
  const supabaseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? "";

  checks.envSupabaseUrl = supabaseUrl
    ? { ok: true, detail: `défini (host: ${safeHost(supabaseUrl)})` }
    : { ok: false, detail: "VIDE — vérifier NEXT_PUBLIC_SUPABASE_URL sur Vercel + redeploy sans cache" };

  checks.envSupabaseAnonKey = anonKey
    ? {
        ok: true,
        detail: `défini (longueur ${anonKey.length}, commence par "${anonKey.slice(0, 6)}...")`,
      }
    : { ok: false, detail: "VIDE — vérifier NEXT_PUBLIC_SUPABASE_ANON_KEY sur Vercel + redeploy sans cache" };

  checks.envAnthropicKey = anthropicKey
    ? {
        ok: anthropicKey.startsWith("sk-ant-"),
        detail: `défini (longueur ${anthropicKey.length}, commence par "${anthropicKey.slice(0, 8)}...")`,
      }
    : { ok: false, detail: "VIDE — vérifier ANTHROPIC_API_KEY sur Vercel + redeploy" };

  checks.envAppUrl = process.env.NEXT_PUBLIC_APP_URL
    ? { ok: true, detail: process.env.NEXT_PUBLIC_APP_URL }
    : { ok: false, detail: "non défini (pas bloquant)" };

  checks.isSupabaseConfigured = {
    ok: isSupabaseConfigured(),
    detail: isSupabaseConfigured()
      ? "vrai → l'app utilise Supabase normalement"
      : "FAUX → mode démo activé, login bypassé",
  };

  // 2. Connexion réseau Supabase
  if (supabaseUrl && anonKey) {
    try {
      const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
        headers: { apikey: anonKey },
        cache: "no-store",
      });
      checks.supabaseAuthReachable = {
        ok: res.ok,
        detail: `HTTP ${res.status} — ${res.ok ? "Supabase auth répond" : "Supabase auth ne répond pas correctement"}`,
      };
    } catch (err) {
      checks.supabaseAuthReachable = {
        ok: false,
        detail: `Échec fetch : ${(err as Error).message}`,
      };
    }

    // 3. Test rapide d'une requête REST (vérifie l'anon key)
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/clients?select=id&limit=1`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        cache: "no-store",
      });
      const body = await res.text();
      checks.supabaseRestReachable = {
        ok: res.ok,
        detail: res.ok
          ? `HTTP 200 — table clients lisible`
          : `HTTP ${res.status} — ${truncate(body, 200)}`,
      };
    } catch (err) {
      checks.supabaseRestReachable = {
        ok: false,
        detail: `Échec fetch : ${(err as Error).message}`,
      };
    }
  } else {
    checks.supabaseAuthReachable = {
      ok: false,
      detail: "non testé (env vars manquantes)",
    };
    checks.supabaseRestReachable = {
      ok: false,
      detail: "non testé (env vars manquantes)",
    };
  }

  const ok = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    {
      ok,
      mode: isSupabaseConfigured() ? "production" : "demo",
      timestamp: new Date().toISOString(),
      checks,
      hint: ok
        ? "Tout est OK. Tu peux te connecter normalement."
        : "Au moins un check échoue. Regarde 'detail' pour chaque ligne FAUSSE.",
    },
    { status: ok ? 200 : 500 },
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "url-invalide";
  }
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}...` : s;
}
