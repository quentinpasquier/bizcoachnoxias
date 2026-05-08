import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateProspectReply } from "@/lib/prospect-engine";
import type {
  Client,
  Difficulty,
  Gender,
  MessageRow,
  Scenario,
  SessionRow,
} from "@/lib/supabase/types";

export const maxDuration = 60;

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

  const { data: sessionData, error: sessionErr } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  if (sessionErr || !sessionData) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }
  const session = sessionData as SessionRow;
  if (session.user_id !== user.id) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (session.status !== "active") {
    return NextResponse.json(
      { error: "Cette session est terminée" },
      { status: 409 },
    );
  }

  if (!session.scenario_data || !session.gender) {
    return NextResponse.json(
      { error: "Session sans scénario ou sans genre — création legacy non supportée." },
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
    return NextResponse.json({ error: "Message vide" }, { status: 400 });
  }

  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .in("role", ["user", "prospect"])
    .order("created_at", { ascending: true });

  const turns = (history ?? []).map((m) => ({
    role: (m as { role: string; content: string }).role as "user" | "prospect",
    content: (m as { role: string; content: string }).content,
  }));

  let reply;
  try {
    reply = await generateProspectReply({
      difficulty: session.difficulty as Difficulty,
      gender: session.gender as Gender,
      client,
      scenario,
      history: turns,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  let prospectMessage: Pick<MessageRow, "id" | "content"> | null = null;
  if (reply.text && reply.text.length > 0) {
    const { data: inserted, error: insertProspectErr } = await supabase
      .from("messages")
      .insert({
        session_id: sessionId,
        role: "prospect",
        content: reply.text,
        metadata:
          reply.signal.type === "hangup"
            ? { signal: "hangup", reason: reply.signal.reason }
            : reply.signal.type === "appointment"
              ? { signal: "appointment", date: reply.signal.date }
              : { signal: "continue" },
      })
      .select("id, content")
      .single();
    if (insertProspectErr) {
      return NextResponse.json(
        { error: insertProspectErr.message },
        { status: 500 },
      );
    }
    prospectMessage = inserted as Pick<MessageRow, "id" | "content">;
  }

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
