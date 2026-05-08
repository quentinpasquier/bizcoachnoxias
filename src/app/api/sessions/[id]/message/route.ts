import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateProspectReply } from "@/lib/prospect-engine";
import type { Difficulty, MessageRow } from "@/lib/supabase/types";

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

  const body = (await request.json().catch(() => ({}))) as {
    content?: string | null;
    opening?: boolean;
  };

  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  if (sessionErr || !session) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }
  if (session.user_id !== user.id) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (session.status !== "active") {
    return NextResponse.json(
      { error: "Cette session est terminée" },
      { status: 409 },
    );
  }

  // Insert user message si fourni.
  if (body.content && body.content.trim().length > 0) {
    const { error: insertErr } = await supabase.from("messages").insert({
      session_id: sessionId,
      role: "user",
      content: body.content.trim(),
    });
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
  } else if (!body.opening) {
    return NextResponse.json(
      { error: "Message vide" },
      { status: 400 },
    );
  }

  // Récup historique complet.
  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .in("role", ["user", "prospect"])
    .order("created_at", { ascending: true });

  const turns = (history ?? []).map((m) => ({
    role: m.role as "user" | "prospect",
    content: m.content,
  }));

  // Génère la réponse du prospect.
  let reply;
  try {
    reply = await generateProspectReply({
      difficulty: session.difficulty as Difficulty,
      personaKey: session.persona_key,
      productPitch: session.product_pitch,
      history: turns,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }

  // Insert prospect message si non vide.
  let prospectMessage: Pick<MessageRow, "id" | "content"> | null = null;
  if (reply.text && reply.text.length > 0) {
    const { data: inserted, error: insertProspectErr } = await supabase
      .from("messages")
      .insert({
        session_id: sessionId,
        role: "prospect",
        content: reply.text,
        metadata: { signal: reply.signal.type },
      })
      .select("id, content")
      .single();
    if (insertProspectErr) {
      return NextResponse.json(
        { error: insertProspectErr.message },
        { status: 500 },
      );
    }
    prospectMessage = inserted;
  }

  // Si signal hangup ou appointment, on ferme la session.
  let sessionEnded = false;
  if (reply.signal.type === "hangup") {
    await supabase
      .from("sessions")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        ended_by: "prospect",
        appointment_secured: false,
      })
      .eq("id", sessionId);
    sessionEnded = true;
  } else if (reply.signal.type === "appointment") {
    await supabase
      .from("sessions")
      .update({
        status: "completed",
        ended_at: new Date().toISOString(),
        ended_by: "user",
        appointment_secured: true,
      })
      .eq("id", sessionId);
    sessionEnded = true;
  }

  return NextResponse.json({
    prospectMessage,
    signal: reply.signal,
    sessionEnded,
  });
}
