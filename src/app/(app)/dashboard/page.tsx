import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { DifficultyBadge, ScoreBadge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import { formatRelativeFr } from "@/lib/format";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", user!.id)
    .order("started_at", { ascending: false })
    .limit(5);

  const { data: completedSessions } = await supabase
    .from("sessions")
    .select("score, appointment_secured, difficulty")
    .eq("user_id", user!.id)
    .eq("status", "completed");

  const totalSessions = completedSessions?.length ?? 0;
  const avgScore =
    totalSessions > 0
      ? Math.round(
          (completedSessions ?? []).reduce(
            (acc, s) => acc + (s.score ?? 0),
            0,
          ) / totalSessions,
        )
      : null;
  const rdvSecured =
    completedSessions?.filter((s) => s.appointment_secured).length ?? 0;
  const rdvRate =
    totalSessions > 0 ? Math.round((rdvSecured / totalSessions) * 100) : 0;

  return (
    <div className="container-noxias py-10 space-y-10">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <span className="divider-green block mb-3" />
          <h1 className="text-h2">Tableau de bord</h1>
          <p
            className="text-body mt-1"
            style={{ color: "var(--color-gray)" }}
          >
            Tes performances et ta prochaine session.
          </p>
        </div>
        <Link href="/sessions/new" className="btn btn-primary">
          Démarrer une session
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          number={totalSessions.toString()}
          label="Sessions terminées"
        />
        <StatCard
          number={avgScore !== null ? `${avgScore}` : "—"}
          suffix={avgScore !== null ? "/100" : undefined}
          label="Score moyen"
        />
        <StatCard
          number={`${rdvRate}%`}
          label="Taux de RDV obtenus"
          accent
        />
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-h3">Sessions récentes</h2>
          <Link
            href="/history"
            className="text-small font-medium hover:underline"
            style={{ color: "var(--color-purple)" }}
          >
            Tout voir →
          </Link>
        </div>

        {sessions && sessions.length > 0 ? (
          <div className="space-y-3">
            {sessions.map((s) => (
              <Link
                key={s.id}
                href={
                  s.status === "active"
                    ? `/sessions/${s.id}`
                    : `/sessions/${s.id}/feedback`
                }
                className="block"
              >
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="flex items-center gap-3 mb-1">
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
                      </div>
                      <p
                        className="text-small"
                        style={{ color: "var(--color-gray)" }}
                      >
                        {formatRelativeFr(s.started_at)}
                        {s.product_pitch ? ` · ${s.product_pitch}` : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {s.appointment_secured && (
                        <span
                          className="badge"
                          style={{
                            background: "rgba(60, 200, 121, 0.18)",
                            color: "#1F6A3F",
                          }}
                        >
                          ✓ RDV obtenu
                        </span>
                      )}
                      <ScoreBadge score={s.score} />
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card variant="lavender" className="text-center py-12">
            <h3 className="text-h3 mb-2">Pas encore de session.</h3>
            <p
              className="text-body mb-6"
              style={{ color: "var(--color-gray)" }}
            >
              Démarre ta première simulation. 5 minutes, restitution immédiate.
            </p>
            <Link
              href="/sessions/new"
              className="btn btn-primary inline-flex"
            >
              Démarrer maintenant
            </Link>
          </Card>
        )}
      </section>
    </div>
  );
}

function StatCard({
  number,
  suffix,
  label,
  accent,
}: {
  number: string;
  suffix?: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <Card variant={accent ? "dark" : "default"}>
      <div
        className="font-display"
        style={{
          fontSize: "4.5rem",
          lineHeight: "1",
          color: accent ? "var(--color-green)" : "var(--color-purple)",
        }}
      >
        {number}
        {suffix && (
          <span
            style={{
              fontSize: "1.5rem",
              opacity: 0.6,
              marginLeft: "0.25rem",
            }}
          >
            {suffix}
          </span>
        )}
      </div>
      <div
        className="text-meta uppercase tracking-widest mt-2"
        style={{ color: accent ? "rgba(255,255,255,0.6)" : "var(--color-gray)" }}
      >
        {label}
      </div>
    </Card>
  );
}
