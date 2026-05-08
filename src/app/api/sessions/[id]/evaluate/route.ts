import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { evaluateSession } from "@/lib/evaluator";
import type { Difficulty } from "@/lib/supabase/types";

export const maxDuration = 60;

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

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (!session || session.user_id !== user.id) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
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

  const { data: messages } = await supabase
    .from("messages")
    .select("role, content, metadata")
    .eq("session_id", sessionId)
    .in("role", ["user", "prospect"])
    .order("created_at", { ascending: true });

  if (!messages || messages.length === 0) {
    // Pas de conversation = score 0, evaluation minimale
    const empty = {
      overall_score: 0,
      axes: {
        accroche: { score: 0, comment: "Aucune accroche tentée." },
        decouverte: { score: 0, comment: "Aucune découverte." },
        objections: { score: 0, comment: "Aucune objection à gérer." },
        valeur: { score: 0, comment: "Aucune valeur transmise." },
        closing: { score: 0, comment: "Aucun closing." },
      },
      strengths: ["Tu as démarré la session — c'est déjà un pas."],
      improvements: [
        "Engage la conversation — un commercial silencieux ne décroche jamais de RDV.",
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

  // Détecter raison de hangup depuis le metadata du dernier message prospect.
  let hangupReason: string | undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "prospect" && m.metadata) {
      const meta = m.metadata as Record<string, unknown>;
      if (meta.signal === "hangup" && typeof meta.reason === "string") {
        hangupReason = meta.reason;
        break;
      }
    }
  }

  try {
    const evaluation = await evaluateSession({
      difficulty: session.difficulty as Difficulty,
      personaKey: session.persona_key,
      productPitch: session.product_pitch,
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
