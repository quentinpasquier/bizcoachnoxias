import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { evaluateCoachCheck } from "@/lib/coach-engine";
import type { Client, Scenario, SessionRow } from "@/lib/supabase/types";

export const maxDuration = 30;
export const runtime = "nodejs";

// POST /api/sessions/[id]/coach-check
// Mode "Coaching embarqué" uniquement. Évalue si la réponse du commercial
// fait avancer la conversation. Si non, renvoie un verdict 'block' avec
// une explication courte (pour le coach audio) + une formulation modèle.
//
// Le client appelle CET endpoint AVANT /api/sessions/[id]/message. Si
// verdict = 'pass' ou 'force_unlock', il enchaîne sur message. Sinon il
// fait jouer le coach et redemande au commercial de reformuler.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  let body: { userText?: string; attemptsOnThisReply?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON invalide" }, { status: 400 });
  }
  const userText = (body.userText ?? "").trim();
  const attemptsOnThisReply = Math.max(
    0,
    Math.floor(body.attemptsOnThisReply ?? 0),
  );
  if (!userText) {
    return NextResponse.json({ error: "Texte vide" }, { status: 400 });
  }

  const { data: sessionData } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  if (!sessionData) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }
  const session = sessionData as SessionRow;
  if (session.user_id !== user.id) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (session.training_mode !== "embedded") {
    return NextResponse.json(
      { error: "Cet endpoint n'est utilisable qu'en mode 'embedded'." },
      { status: 409 },
    );
  }
  if (!session.scenario_data) {
    return NextResponse.json(
      { error: "Session sans scénario, coaching impossible." },
      { status: 409 },
    );
  }
  if (!session.client_id) {
    return NextResponse.json(
      { error: "Session sans client associé." },
      { status: 409 },
    );
  }

  const { data: clientData } = await supabase
    .from("clients")
    .select("*")
    .eq("id", session.client_id)
    .single();
  if (!clientData) {
    return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
  }

  const { data: messagesData } = await supabase
    .from("messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .in("role", ["user", "prospect"])
    .order("created_at", { ascending: true });

  const history = ((messagesData ?? []) as { role: string; content: string }[])
    .map((m) => ({
      role: m.role as "user" | "prospect",
      content: m.content,
    }));

  try {
    const result = await evaluateCoachCheck({
      client: clientData as Client,
      scenario: session.scenario_data as Scenario,
      blockTarget: session.block_target,
      history,
      userText,
      attemptsOnThisReply,
    });

    // Incrémente le compteur de blocages session uniquement quand le
    // coach a effectivement bloqué (pas sur pass ni sur force_unlock,
    // ces deux cas laissent passer la réponse).
    if (result.verdict === "block" && session.training_mode === "embedded") {
      await supabase
        .from("sessions")
        .update({
          embedded_blocks_count: (session.embedded_blocks_count ?? 0) + 1,
        })
        .eq("id", sessionId);
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
