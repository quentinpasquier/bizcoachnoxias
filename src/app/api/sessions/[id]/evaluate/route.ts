import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { evaluateSession } from "@/lib/evaluator";
import type { Client, Difficulty, Scenario, SessionRow } from "@/lib/supabase/types";

// 180s : Sonnet sur cache froid + long transcript peut dépasser 60s.
// Vercel Pro autorise jusqu'à 300s sur les Serverless Functions, on prend
// 180s qui donne 3× de marge sur le temps réel observé (~30-45s typique).
export const maxDuration = 180;
export const runtime = "nodejs";

export async function POST(
  _request: Request,
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

  if (session.evaluation) {
    return NextResponse.json({ ok: true, alreadyEvaluated: true });
  }

  if (session.status === "active") {
    return NextResponse.json(
      { error: "La session est encore en cours" },
      { status: 409 },
    );
  }

  if (!session.scenario_data) {
    return NextResponse.json(
      { error: "Session legacy sans scénario. pas évaluable." },
      { status: 409 },
    );
  }
  const scenario = session.scenario_data as Scenario;

  let client: Client | null = null;
  if (session.client_id) {
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("id", session.client_id)
      .single();
    client = (data as Client) ?? null;
  }
  if (!client) {
    return NextResponse.json(
      { error: "Client introuvable pour cette session" },
      { status: 404 },
    );
  }

  const { data: messagesData } = await supabase
    .from("messages")
    .select("role, content, metadata")
    .eq("session_id", sessionId)
    .in("role", ["user", "prospect"])
    .order("created_at", { ascending: true });

  const messages = (messagesData ?? []) as Array<{
    role: string;
    content: string;
    metadata: Record<string, unknown> | null;
  }>;

  if (messages.length === 0) {
    const { SCORING_CATEGORIES } = await import("@/lib/scoring-criteria");
    const empty = {
      overall_score: 0,
      criteria_total: 0,
      criteria_max: SCORING_CATEGORIES.reduce((acc, c) => acc + c.criteria.length, 0),
      categories: SCORING_CATEGORIES.map((cat) => ({
        key: cat.key,
        label: cat.label,
        score: 0,
        max: cat.criteria.length,
        criteria: cat.criteria.map((c) => ({
          id: c.id,
          label: c.label,
          passed: false,
          comment: "Aucun échange. critère non observable.",
        })),
      })),
      strengths: ["Tu as démarré la session. c'est déjà un pas."],
      improvements: [
        "Engage la conversation. un commercial silencieux ne décroche jamais de RDV.",
      ],
      next_steps: [
        "Relance une session, et envoie au moins 3 messages pour construire un appel complet.",
      ],
      outcome_summary:
        "La session s'est terminée sans qu'aucun échange réel n'ait eu lieu.",
    };
    await supabase
      .from("sessions")
      .update({ score: 0, evaluation: empty })
      .eq("id", sessionId);
    return NextResponse.json({ ok: true });
  }

  let hangupReason: string | undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "prospect" && m.metadata) {
      if (m.metadata.signal === "hangup" && typeof m.metadata.reason === "string") {
        hangupReason = m.metadata.reason;
        break;
      }
    }
  }

  try {
    const evaluation = await evaluateSession({
      difficulty: session.difficulty as Difficulty,
      scenario,
      client,
      conversation: messages.map((m) => ({
        role: m.role as "user" | "prospect",
        content: m.content,
      })),
      endedBy: (session.ended_by ?? "user") as "user" | "prospect" | "timeout",
      appointmentSecured: session.appointment_secured,
      hangupReason,
    });

    await supabase
      .from("sessions")
      .update({
        score: evaluation.overall_score,
        evaluation,
      })
      .eq("id", sessionId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
