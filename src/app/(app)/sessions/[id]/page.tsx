import { notFound, redirect } from "next/navigation";
import { ChatRoom } from "./ChatRoom";
import { createClient } from "@/lib/supabase/server";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: session, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !session) notFound();

  if (session.status === "completed" || session.status === "abandoned") {
    redirect(`/sessions/${id}/feedback`);
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  return <ChatRoom session={session} initialMessages={messages ?? []} />;
}
