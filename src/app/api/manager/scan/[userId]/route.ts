import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scanCommercial, type CoachScanResult } from "@/lib/coach-scan";
import type {
  MessageRow,
  SessionRow,
  UserRole,
} from "@/lib/supabase/types";
import { isManagerOrAbove } from "@/lib/auth-helpers";

export const maxDuration = 90;
export const runtime = "nodejs";

const CACHE_TTL_HOURS = 24;
const SESSIONS_TO_SCAN = 5;

// GET : retourne le dernier scan en cache (< 24h) pour ce commercial,
//       ou null s'il n'y en a pas. Lecture rapide pour l'affichage.
//
// POST : lance un nouveau scan (consomme Claude Sonnet, ~$0.05). Stocke
//        le résultat dans commercial_scans et retourne le résultat.
//        Le manager doit cliquer "Scanner" pour déclencher.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();
  const role = (profile as { role?: UserRole } | null)?.role ?? null;
  if (!isManagerOrAbove(role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Récupère le dernier scan < CACHE_TTL_HOURS de ce commercial
  // (RLS vérifie organization_id côté DB).
  const sinceTs = new Date(
    Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000,
  ).toISOString();
  const { data: latestScan } = await supabase
    .from("commercial_scans")
    .select("scanned_at, sessions_analyzed, analysis")
    .eq("user_id", userId)
    .gte("scanned_at", sinceTs)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestScan) {
    return NextResponse.json({ scan: null });
  }
  return NextResponse.json({ scan: latestScan });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: meProfile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();
  const role = (meProfile as { role?: UserRole } | null)?.role ?? null;
  const myOrgId = (meProfile as { organization_id?: string } | null)
    ?.organization_id;
  if (!isManagerOrAbove(role) || !myOrgId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Vérifie que le commercial cible appartient à la même org.
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id, full_name, organization_id")
    .eq("id", userId)
    .single();
  const targetOrgId = (targetProfile as { organization_id?: string } | null)
    ?.organization_id;
  const commercialName =
    (targetProfile as { full_name?: string | null } | null)?.full_name ??
    "Commercial";
  if (!targetProfile || targetOrgId !== myOrgId) {
    return NextResponse.json(
      { error: "Commercial introuvable dans votre organisation." },
      { status: 404 },
    );
  }

  // Récupère les 5 dernières sessions complètes du commercial avec
  // leurs transcripts. On filtre status='completed' pour ne pas tomber
  // sur des sessions abandonnées en cours.
  const { data: sessionsData } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("organization_id", myOrgId)
    .eq("status", "completed")
    .order("started_at", { ascending: false })
    .limit(SESSIONS_TO_SCAN);
  const sessions = (sessionsData ?? []) as SessionRow[];
  if (sessions.length === 0) {
    return NextResponse.json(
      {
        error:
          "Ce commercial n'a aucune session complétée. Lancez le scan quand il en aura au moins 3.",
      },
      { status: 409 },
    );
  }

  // Récupère les messages pour ces sessions.
  const sessionIds = sessions.map((s) => s.id);
  const { data: messagesData } = await supabase
    .from("messages")
    .select("session_id, role, content, metadata, created_at")
    .in("session_id", sessionIds)
    .in("role", ["user", "prospect"])
    .order("created_at", { ascending: true });

  const messagesBySession = new Map<
    string,
    Pick<MessageRow, "role" | "content" | "metadata">[]
  >();
  for (const m of (messagesData ?? []) as {
    session_id: string;
    role: string;
    content: string;
    metadata: Record<string, unknown> | null;
  }[]) {
    const arr = messagesBySession.get(m.session_id) ?? [];
    arr.push({
      role: m.role as "user" | "prospect",
      content: m.content,
      metadata: m.metadata,
    });
    messagesBySession.set(m.session_id, arr);
  }

  // Lance le scan IA.
  let analysis: CoachScanResult;
  try {
    analysis = await scanCommercial({
      commercialName,
      sessions: sessions.map((s) => ({
        session: s,
        messages: messagesBySession.get(s.id) ?? [],
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Scan échoué : ${(err as Error).message}` },
      { status: 500 },
    );
  }

  // Stocke le scan en DB (cache 24h via lecture côté GET).
  const { data: inserted, error: insertErr } = await supabase
    .from("commercial_scans")
    .insert({
      user_id: userId,
      organization_id: myOrgId,
      scanned_by: user.id,
      sessions_analyzed: sessions.length,
      analysis,
    })
    .select("scanned_at, sessions_analyzed, analysis")
    .single();
  if (insertErr || !inserted) {
    // L'analyse est OK mais le storage a planté : on retourne quand même
    // le résultat pour ne pas frustrer le manager.
    return NextResponse.json({
      scan: { scanned_at: new Date().toISOString(), sessions_analyzed: sessions.length, analysis },
      warning: insertErr?.message,
    });
  }
  return NextResponse.json({ scan: inserted });
}
