import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge, DifficultyBadge, ScoreBadge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formatRelativeFr } from "@/lib/format";
import type { Client, SessionRow } from "@/lib/supabase/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const configured = isSupabaseConfigured();

  let sessions: SessionRow[] = [];
  let completedSessions: Pick<
    SessionRow,
    "score" | "appointment_secured" | "difficulty" | "client_id"
  >[] = [];
  let clients: Pick<Client, "id" | "name" | "sector">[] = [];

  if (configured) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const [{ data: sessionsData }, { data: completedData }, { data: clientsData }] =
        await Promise.all([
          supabase
            .from("sessions")
            .select("*")
            .eq("user_id", user.id)
            .order("started_at", { ascending: false })
            .limit(5),
          supabase
            .from("sessions")
            .select("score, appointment_secured, difficulty, client_id")
            .eq("user_id", user.id)
            .eq("status", "completed"),
          supabase
            .from("clients")
            .select("id, name, sector")
            .eq("active", true)
            .order("name", { ascending: true }),
        ]);

      sessions = (sessionsData ?? []) as SessionRow[];
      completedSessions = (completedData ?? []) as typeof completedSessions;
      clients = (clientsData ?? []) as typeof clients;
    }
  }

  const totalSessions = completedSessions.length;
  const avgScore =
    totalSessions > 0
      ? Math.round(
          completedSessions.reduce((acc, s) => acc + (s.score ?? 0), 0) /
            totalSessions,
        )
      : null;
  const rdvSecured = completedSessions.filter((s) => s.appointment_secured).length;
  const rdvRate =
    totalSessions > 0 ? Math.round((rdvSecured / totalSessions) * 100) : 0;

  const clientById = new Map(clients.map((c) => [c.id, c]));

  return (
    <div className="container-noxias py-12 space-y-12">
      {/* HERO */}
      <header className="flex items-end justify-between flex-wrap gap-6">
        <div>
          <span className="divider-green block mb-4" />
          <h1 className="text-h2">Bonjour.</h1>
          <p
            className="text-body-l mt-2"
            style={{ color: "var(--color-gray)" }}
          >
            Tes performances et ta prochaine session.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/clients" className="btn btn-ghost">
            Voir les clients
          </Link>
          <Link href="/sessions/new" className="btn btn-primary">
            Démarrer une session
          </Link>
        </div>
      </header>

      {/* STATS */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard
          number={totalSessions.toString()}
          label="Sessions terminées"
        />
        <StatCard
          number={avgScore !== null ? `${avgScore}` : "·"}
          suffix={avgScore !== null ? "/100" : undefined}
          label="Score moyen"
        />
        <StatCard
          number={`${rdvRate}%`}
          label="RDV obtenus"
          accent
        />
      </section>

      {/* QUICK START : clients */}
      {clients.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            title="Démarrer pour un client"
            action={
              clients.length > 6 ? (
                <Link
                  href="/clients"
                  className="text-small font-medium hover:underline"
                  style={{ color: "var(--color-purple)" }}
                >
                  Voir les {clients.length} clients →
                </Link>
              ) : undefined
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.slice(0, 6).map((c) => (
              <Link key={c.id} href={`/clients/${c.id}`}>
                <Card hoverable>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-h4 truncate">{c.name}</div>
                      {c.sector && (
                        <div className="section-eyebrow mt-1">{c.sector}</div>
                      )}
                    </div>
                    <span
                      className="text-h4"
                      style={{ color: "var(--color-green)" }}
                      aria-hidden="true"
                    >
                      →
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* RECENT SESSIONS */}
      <section className="space-y-4">
        <SectionHeader
          title="Sessions récentes"
          action={
            sessions.length > 0 ? (
              <Link
                href="/history"
                className="text-small font-medium hover:underline"
                style={{ color: "var(--color-purple)" }}
              >
                Tout l&apos;historique →
              </Link>
            ) : undefined
          }
        />

        {sessions.length > 0 ? (
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
                  className="block"
                >
                  <Card hoverable>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex-1 min-w-[200px]">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <Badge tone="purple">{clientName}</Badge>
                          <span className="text-h4">{s.persona_label}</span>
                          <DifficultyBadge difficulty={s.difficulty} />
                          {s.status === "active" && (
                            <Badge tone="success">En cours</Badge>
                          )}
                        </div>
                        <p
                          className="text-small"
                          style={{ color: "var(--color-gray)" }}
                        >
                          {formatRelativeFr(s.started_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {s.appointment_secured && (
                          <Badge tone="success">RDV obtenu</Badge>
                        )}
                        <ScoreBadge score={s.score} />
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card variant="lavender" className="text-center py-12">
            <h3 className="text-h3 mb-2">Pas encore de session.</h3>
            <p
              className="text-body mb-6"
              style={{ color: "var(--color-gray)" }}
            >
              {configured
                ? "Lance ta première simulation, restitution immédiate."
                : "Mode démo. Connecte Supabase pour voir tes vraies sessions."}
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
      <div className="section-eyebrow mb-3" style={{ color: accent ? "rgba(255,255,255,0.55)" : "var(--color-gray)" }}>
        {label}
      </div>
      <div
        className="font-display"
        style={{
          fontSize: "4rem",
          lineHeight: "1",
          color: accent ? "var(--color-green)" : "var(--color-purple)",
        }}
      >
        {number}
        {suffix && (
          <span
            style={{
              fontSize: "1.25rem",
              opacity: 0.55,
              marginLeft: "0.25rem",
            }}
          >
            {suffix}
          </span>
        )}
      </div>
    </Card>
  );
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap">
      <h2 className="text-h3">{title}</h2>
      {action}
    </div>
  );
}
