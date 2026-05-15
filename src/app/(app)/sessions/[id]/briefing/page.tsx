import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DIFFICULTY_CONFIG } from "@/lib/personas";
import type {
  Client,
  Difficulty,
  PersonaProfile,
  SessionRow,
} from "@/lib/supabase/types";
import { BriefingScreen } from "./BriefingScreen";

export const dynamic = "force-dynamic";

export default async function BriefingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: sessionData } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .single();
  if (!sessionData) notFound();
  const session = sessionData as SessionRow;

  // Si la session est déjà entamée (ou terminée), on saute le brief.
  if (session.status === "completed" || session.status === "abandoned") {
    redirect(`/sessions/${id}/feedback`);
  }

  const [{ data: clientData }, { count: messageCount }] = await Promise.all([
    session.client_id
      ? supabase.from("clients").select("*").eq("id", session.client_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("session_id", id),
  ]);

  // Si la conversation a déjà commencé, on saute le brief direct vers le chat.
  if ((messageCount ?? 0) > 0) {
    redirect(`/sessions/${id}`);
  }

  const client = clientData as Client | null;
  const persona =
    (client?.persona_profiles ?? []).find(
      (p) => p.label.toLowerCase() === session.persona_label.toLowerCase(),
    ) ?? null;

  return (
    <BriefingScreen
      sessionId={id}
      session={session}
      client={client}
      persona={persona as PersonaProfile | null}
      difficultyConfig={DIFFICULTY_CONFIG[session.difficulty as Difficulty]}
    />
  );
}
