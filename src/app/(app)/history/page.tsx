import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { HistoryBoard } from "./HistoryBoard";
import type { Client, SessionRow, UserRole } from "@/lib/supabase/types";

export default async function HistoryPage() {
  const supabase = await createClient();
  const configured = isSupabaseConfigured();

  let sessions: SessionRow[] = [];
  let clients: Pick<Client, "id" | "name" | "sector">[] = [];
  let profileById: Record<string, { full_name: string; avatar_url: string | null }> = {};
  let myUserId: string | null = null;
  let role: UserRole = "commercial";

  if (configured) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) myUserId = user.id;

    const [
      { data: profileData },
      { data: sessionsData },
      { data: clientsData },
      { data: profilesData },
    ] = await Promise.all([
      user
        ? supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single()
        : Promise.resolve({ data: null }),
      supabase
        .from("sessions")
        .select("*")
        .order("started_at", { ascending: false }),
      supabase.from("clients").select("id, name, sector"),
      supabase.from("profiles").select("id, full_name, avatar_url"),
    ]);

    role = ((profileData as { role?: UserRole } | null)?.role ?? "commercial") as UserRole;
    sessions = (sessionsData ?? []) as SessionRow[];
    clients = (clientsData ?? []) as typeof clients;
    profileById = Object.fromEntries(
      (
        (profilesData ?? []) as {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
        }[]
      ).map((p) => [
        p.id,
        { full_name: p.full_name ?? "Anonyme", avatar_url: p.avatar_url },
      ]),
    );
  }

  const clientByIdObj = Object.fromEntries(
    clients.map((c) => [c.id, { name: c.name, sector: c.sector }]),
  );

  const isManager = role === "manager";
  const subtitle =
    sessions.length === 0
      ? "Aucune session pour l'instant"
      : isManager
        ? `${sessions.length} session${sessions.length > 1 ? "s" : ""} de l'équipe`
        : `${sessions.length} de tes session${sessions.length > 1 ? "s" : ""}`;

  return (
    <div className="container-noxias py-12 space-y-8">
      <PageHeader
        title={isManager ? "Historique équipe" : "Ton historique"}
        subtitle={subtitle}
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
          isManager={isManager}
        />
      )}
    </div>
  );
}
