import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { DifficultyBadge, ScoreBadge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import { formatRelativeFr, formatDuration } from "@/lib/format";

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", user!.id)
    .order("started_at", { ascending: false });

  return (
    <div className="container-noxias py-10 space-y-8">
      <div>
        <span className="divider-green block mb-3" />
        <h1 className="text-h2">Historique</h1>
        <p className="text-body mt-1" style={{ color: "var(--color-gray)" }}>
          Toutes tes sessions, des plus récentes aux plus anciennes.
        </p>
      </div>

      {!sessions || sessions.length === 0 ? (
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
          {sessions.map((s) => (
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
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-h4">{s.persona_label}</span>
                      <DifficultyBadge difficulty={s.difficulty} />
                      {s.status === "active" && (
                        <span
                          className="badge"
                          style={{
                            background: "rgba(60, 200, 121, 0.18)",
                            color: "#1F6A3F",
                          }}
                        >
                          En cours
                        </span>
                      )}
                      {s.appointment_secured && (
                        <span
                          className="badge"
                          style={{
                            background: "rgba(60, 200, 121, 0.18)",
                            color: "#1F6A3F",
                          }}
                        >
                          ✓ RDV
                        </span>
                      )}
                      {s.ended_by === "prospect" && !s.appointment_secured && (
                        <span
                          className="badge"
                          style={{
                            background: "rgba(233, 75, 75, 0.16)",
                            color: "#A61F1F",
                          }}
                        >
                          Raccroché
                        </span>
                      )}
                    </div>
                    <p
                      className="text-small mt-1"
                      style={{ color: "var(--color-gray)" }}
                    >
                      {formatRelativeFr(s.started_at)} ·{" "}
                      {formatDuration(s.started_at, s.ended_at)}
                      {s.product_pitch ? ` · ${s.product_pitch}` : ""}
                    </p>
                  </div>

                  <ScoreBadge score={s.score} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
