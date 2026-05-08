import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { HistoryBoard } from "./HistoryBoard";
import type { Client, SessionRow } from "@/lib/supabase/types";

export default async function HistoryPage() {
  const supabase = await createClient();
  const configured = isSupabaseConfigured();

  let sessions: SessionRow[] = [];
  let clients: Pick<Client, "id" | "name" | "sector">[] = [];
  let profileById: Record<string, string> = {};
  let myUserId: string | null = null;

  if (configured) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) myUserId = user.id;

    const [
      { data: sessionsData },
      { data: clientsData },
      { data: profilesData },
    ] = await Promise.all([
      supabase
        .from("sessions")
        .select("*")
        .order("started_at", { ascending: false }),
      supabase.from("clients").select("id, name, sector"),
      supabase.from("profiles").select("id, full_name"),
    ]);

    sessions = (sessionsData ?? []) as SessionRow[];
    clients = (clientsData ?? []) as typeof clients;
    profileById = Object.fromEntries(
      ((profilesData ?? []) as { id: string; full_name: string | null }[]).map(
        (p) => [p.id, p.full_name ?? "Anonyme"],
      ),
    );
  }

  const clientByIdObj = Object.fromEntries(
    clients.map((c) => [c.id, { name: c.name, sector: c.sector }]),
  );

  return (
    <div className="container-noxias py-12 space-y-8">
      <PageHeader
        title="Historique"
        subtitle={
          sessions.length > 0
            ? `${sessions.length} session${sessions.length > 1 ? "s" : ""} de l'équipe`
            : "Aucune session pour l'instant"
        }
      />

      {sessions.length === 0 ? (
        <Card variant="lavender" className="text-center py-14">
          <p style={{ color: "var(--color-gray)" }}>
            Aucune session pour l&apos;instant.
          </p>
        </Card>
      ) : (
        <HistoryBoard
          sessions={sessions}
          clientById={clientByIdObj}
          profileById={profileById}
          myUserId={myUserId}
        />
      )}
    </div>
  );
}
