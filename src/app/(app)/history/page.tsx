import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge, DifficultyBadge, ScoreBadge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import { formatRelativeFr, formatDuration } from "@/lib/format";
import type { Client, SessionRow } from "@/lib/supabase/types";

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: sessionsData }, { data: clientsData }] = await Promise.all([
    supabase
      .from("sessions")
      .select("*")
      .eq("user_id", user!.id)
      .order("started_at", { ascending: false }),
    supabase.from("clients").select("id, name, sector"),
  ]);

  const sessions = (sessionsData ?? []) as SessionRow[];
  const clients = (clientsData ?? []) as Pick<Client, "id" | "name" | "sector">[];
  const clientById = new Map(clients.map((c) => [c.id, c]));

  return (
    <div className="container-noxias py-10 space-y-8">
      <div>
        <span className="divider-green block mb-3" />
        <h1 className="text-h2">Historique</h1>
        <p className="text-body mt-1" style={{ color: "var(--color-gray)" }}>
          Toutes tes sessions, des plus récentes aux plus anciennes.
        </p>
      </div>

      {sessions.length === 0 ? (
        <Card variant="lavender" className="text-center py-12">
          <h3 className="text-h3 mb-2">Aucune session pour l'instant.</h3>
          <Link
            href="/sessions/new"
            className="btn btn-primary inline-flex mt-3"
          >
            Démarrer une session
          </Link>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const client = s.client_id ? clientById.get(s.client_id) : null;
            const clientName =
              client?.name ?? s.client_name_snapshot ?? "Client supprimé";
            return (
              <Link
                key={s.id}
                href={
                  s.status === "active"
                    ? `/sessions/${s.id}`
                    : `/sessions/${s.id}/feedback`
                }
              >
                <Card className="hover:shadow-lg transition-shadow cursor-pointer mb-3">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge tone="purple">{clientName}</Badge>
                        <span className="text-h4">{s.persona_label}</span>
                        <DifficultyBadge difficulty={s.difficulty} />
                        {s.status === "active" && (
                          <Badge tone="success">En cours</Badge>
                        )}
                        {s.appointment_secured && (
                          <Badge tone="success">✓ RDV</Badge>
                        )}
                        {s.ended_by === "prospect" && !s.appointment_secured && (
                          <Badge tone="error">Raccroché</Badge>
                        )}
                      </div>
                      <p
                        className="text-small mt-1"
                        style={{ color: "var(--color-gray)" }}
                      >
                        {formatRelativeFr(s.started_at)} ·{" "}
                        {formatDuration(s.started_at, s.ended_at)}
                      </p>
                    </div>

                    <ScoreBadge score={s.score} />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
