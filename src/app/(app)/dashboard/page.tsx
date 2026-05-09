import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/Status";
import { DifficultyBadge, ScoreBadge } from "@/components/ui/Badge";
import { CoachAvatar } from "@/components/CoachAvatar";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formatDateTimeFr } from "@/lib/format";
import type { Client, SessionRow } from "@/lib/supabase/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const configured = isSupabaseConfigured();

  let mySessions: Pick<
    SessionRow,
    "score" | "appointment_secured" | "difficulty" | "client_id"
  >[] = [];
  let teamSessions: SessionRow[] = [];
  let clients: Pick<Client, "id" | "name" | "sector">[] = [];
  let profileById = new Map<string, string>();
  let userName = "Commercial";
  let myUserId: string | null = null;

  if (configured) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      myUserId = user.id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      const fullName = (profile as { full_name?: string | null } | null)?.full_name;
      if (fullName) userName = fullName.split(" ")[0];

      const [
        { data: mySessionsData },
        { data: teamSessionsData },
        { data: clientsData },
        { data: profilesData },
      ] = await Promise.all([
        supabase
          .from("sessions")
          .select("score, appointment_secured, difficulty, client_id")
          .eq("user_id", user.id)
          .eq("status", "completed"),
        supabase
          .from("sessions")
          .select("*")
          .order("started_at", { ascending: false })
          .limit(8),
        supabase
          .from("clients")
          .select("id, name, sector")
          .eq("active", true)
          .order("name", { ascending: true }),
        supabase.from("profiles").select("id, full_name"),
      ]);

      mySessions = (mySessionsData ?? []) as typeof mySessions;
      teamSessions = (teamSessionsData ?? []) as SessionRow[];
      clients = (clientsData ?? []) as typeof clients;
      profileById = new Map(
        ((profilesData ?? []) as { id: string; full_name: string | null }[]).map(
          (p) => [p.id, p.full_name ?? "Anonyme"],
        ),
      );
    }
  }

  const totalSessions = mySessions.length;
  const avgScore =
    totalSessions > 0
      ? Math.round(
          mySessions.reduce((acc, s) => acc + (s.score ?? 0), 0) / totalSessions,
        )
      : null;
  const rdvSecured = mySessions.filter((s) => s.appointment_secured).length;
  const rdvRate =
    totalSessions > 0 ? Math.round((rdvSecured / totalSessions) * 100) : 0;

  const clientById = new Map(clients.map((c) => [c.id, c]));

  return (
    <div className="container-noxias py-12 space-y-12">
      <header className="flex items-end justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-5">
          <CoachAvatar state="idle" size={80} />
          <div>
            <div className="eyebrow-green mb-2">Coach Noxias</div>
            <h1
              className="text-h2"
              style={{ fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: "1.05" }}
            >
              <span style={{ color: "var(--color-dark)" }}>Salut </span>
              <span style={{ color: "var(--color-green)" }}>{userName}</span>
            </h1>
            <p
              className="text-body-l mt-2"
              style={{ color: "var(--color-gray)" }}
            >
              Prêt pour ta session ? Choisis un client, je m&apos;occupe du reste.
            </p>
          </div>
        </div>
        <div className="flex gap-3 shrink-0">
          <Link href="/clients" className="btn btn-ghost">
            Voir les clients
          </Link>
          <Link href="/sessions/new" className="btn btn-dark">
            + On démarre
          </Link>
        </div>
      </header>

      {/* MES STATS */}
      <section>
        <h2 className="text-h3 mb-4">Ta progression</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <StatCard
            number={totalSessions.toString()}
            label="Appels menés"
          />
          <StatCard
            number={avgScore !== null ? `${avgScore}` : "·"}
            suffix={avgScore !== null ? "/100" : undefined}
            label="Ta note moyenne"
          />
          <StatCard
            number={`${rdvRate}%`}
            label="RDV décrochés"
            accent
          />
        </div>
      </section>

      {/* DEMARRER */}
      {clients.length > 0 && (
        <section className="space-y-5">
          <SectionHeader
            title="Tes terrains de jeu"
            action={
              clients.length > 6 ? (
                <Link
                  href="/clients"
                  className="text-small font-semibold"
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
                        <div className="eyebrow mt-1">{c.sector}</div>
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

      {/* ACTIVITE EQUIPE */}
      <section className="space-y-5">
        <SectionHeader
          title="L'équipe en action"
          action={
            teamSessions.length > 0 ? (
              <Link
                href="/history"
                className="text-small font-semibold"
                style={{ color: "var(--color-purple)" }}
              >
                Tout l&apos;historique →
              </Link>
            ) : undefined
          }
        />

        {teamSessions.length > 0 ? (
          <div className="space-y-3">
            {teamSessions.map((s) => {
              const client = s.client_id ? clientById.get(s.client_id) : null;
              const clientName =
                client?.name ?? s.client_name_snapshot ?? "Client supprimé";
              const author = profileById.get(s.user_id) ?? "Anonyme";
              const isMe = s.user_id === myUserId;
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
                          <span
                            className="text-meta font-bold uppercase tracking-widest"
                            style={{ color: "var(--color-purple)" }}
                          >
                            {clientName}
                          </span>
                          <span
                            className="text-meta"
                            style={{ color: "var(--color-gray)" }}
                          >
                            ·
                          </span>
                          <span className="text-h4">{s.persona_label}</span>
                          <DifficultyBadge difficulty={s.difficulty} />
                          {s.status === "active" && (
                            <StatusPill tone="success">En cours</StatusPill>
                          )}
                          {isMe && (
                            <span
                              className="badge"
                              style={{
                                background: "rgba(60, 200, 121, 0.10)",
                                color: "#1F6A3F",
                              }}
                            >
                              Toi
                            </span>
                          )}
                        </div>
                        <p
                          className="text-small"
                          style={{ color: "var(--color-gray)" }}
                        >
                          <span style={{ color: "var(--color-dark)", fontWeight: 500 }}>
                            {author}
                          </span>
                          {" · "}
                          {formatDateTimeFr(s.started_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {s.appointment_secured && (
                          <StatusPill tone="success">RDV obtenu</StatusPill>
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
          <Card variant="lavender" className="text-center py-14">
            <h3 className="text-h3 mb-2">L&apos;équipe attaque bientôt.</h3>
            <p
              className="text-body mb-6"
              style={{ color: "var(--color-gray)" }}
            >
              {configured
                ? "Sois le premier à décrocher. 5 minutes, débrief immédiat."
                : "Mode démo. Connecte Supabase pour voir les sessions."}
            </p>
            <Link
              href="/sessions/new"
              className="btn btn-primary inline-flex"
            >
              On y va
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
        className="eyebrow mb-3"
        style={{
          color: accent ? "rgba(255,255,255,0.55)" : "var(--color-gray)",
        }}
      >
        {label}
      </div>
      <div
        className=""
        style={{
          fontSize: "3.75rem",
          lineHeight: "1",
          color: accent ? "var(--color-green)" : "var(--color-dark)",
        }}
      >
        {number}
        {suffix && (
          <span
            style={{
              fontSize: "1.25rem",
              opacity: 0.55,
              marginLeft: "0.25rem",
              fontWeight: 400,
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
