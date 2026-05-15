import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/Status";
import { DifficultyBadge, ScoreBadge } from "@/components/ui/Badge";
import { CoachAvatar } from "@/components/CoachAvatar";
import { Avatar } from "@/components/ui/Avatar";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formatDateTimeFr } from "@/lib/format";
import type { Client, SessionRow, UserRole } from "@/lib/supabase/types";
import {
  filterTodaysSessions,
  pickDailyMissions,
} from "@/lib/daily-missions";
import {
  totalXp,
  levelProgress,
  rankForLevel,
  nextRank,
} from "@/lib/xp";

export default async function DashboardPage() {
  const supabase = await createClient();
  const configured = isSupabaseConfigured();

  let mySessions: Pick<
    SessionRow,
    "score" | "appointment_secured" | "difficulty" | "client_id"
  >[] = [];
  let myAllSessions: SessionRow[] = [];
  let teamSessions: SessionRow[] = [];
  let clients: Pick<Client, "id" | "name" | "sector">[] = [];
  let profileById = new Map<string, { full_name: string; avatar_url: string | null }>();
  let userName = "Commercial";
  let myUserId: string | null = null;
  let role: UserRole = "commercial";

  if (configured) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      myUserId = user.id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, first_name, role")
        .eq("id", user.id)
        .single();
      const p = profile as {
        full_name?: string | null;
        first_name?: string | null;
        role?: UserRole;
      } | null;
      role = p?.role ?? "commercial";
      const firstName = p?.first_name?.trim();
      if (firstName) userName = firstName;
      else if (p?.full_name) userName = p.full_name.split(" ")[0];

      const [
        { data: myAllSessionsData },
        { data: teamSessionsData },
        { data: clientsData },
        { data: profilesData },
      ] = await Promise.all([
        supabase
          .from("sessions")
          .select("*")
          .eq("user_id", user.id)
          .order("started_at", { ascending: false }),
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
        supabase.from("profiles").select("id, full_name, avatar_url"),
      ]);

      myAllSessions = (myAllSessionsData ?? []) as SessionRow[];
      mySessions = myAllSessions
        .filter((s) => s.status === "completed")
        .map((s) => ({
          score: s.score,
          appointment_secured: s.appointment_secured,
          difficulty: s.difficulty,
          client_id: s.client_id,
        }));
      teamSessions = (teamSessionsData ?? []) as SessionRow[];
      clients = (clientsData ?? []) as typeof clients;
      profileById = new Map(
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
  }
  const isManager = role === "manager";

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

  // Gamification : XP, niveau, rang
  const xpTotal = totalXp(myAllSessions);
  const lvl = levelProgress(xpTotal);
  const currentRank = rankForLevel(lvl.level);
  const upcomingRank = nextRank(lvl.level);

  // Missions du jour : computed côté serveur depuis sessions d'aujourd'hui
  const todaySessions = filterTodaysSessions(myAllSessions);
  const dailyMissions = myUserId
    ? pickDailyMissions(myUserId, todaySessions)
    : [];
  const dailyDone = dailyMissions.filter((m) => m.done).length;
  const dailyTotalXp = dailyMissions
    .filter((m) => m.done)
    .reduce((acc, m) => acc + m.xpReward, 0);

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

      {/* PLAYER CARD : niveau, XP, rang */}
      <section>
        <PlayerCard
          level={lvl.level}
          xpTotal={lvl.xpTotal}
          xpInLevel={lvl.xpInLevel}
          xpToNext={lvl.xpToNext}
          xpForNextLevel={lvl.xpForNextLevel - lvl.xpForCurrentLevel}
          progressPct={lvl.progressPct}
          rankLabel={currentRank.label}
          rankPrimary={currentRank.primary}
          rankSecondary={currentRank.secondary}
          rankGlow={currentRank.glow}
          nextRankLabel={upcomingRank?.label ?? null}
          nextRankAtLevel={upcomingRank?.minLevel ?? null}
        />
      </section>

      {/* MISSIONS DU JOUR */}
      {dailyMissions.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            title="Missions du jour"
            action={
              <span
                className="text-small font-semibold"
                style={{
                  color:
                    dailyDone === dailyMissions.length
                      ? "var(--color-green)"
                      : "var(--color-gray)",
                }}
              >
                {dailyDone}/{dailyMissions.length} bouclées · +{dailyTotalXp} XP
                récupérés
              </span>
            }
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dailyMissions.map((m) => (
              <Card
                key={m.id}
                variant={m.done ? "default" : "lavender"}
                hoverable={false}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="text-3xl shrink-0"
                    style={{
                      filter: m.done ? "none" : "grayscale(0.5)",
                      opacity: m.done ? 1 : 0.8,
                    }}
                    aria-hidden="true"
                  >
                    {m.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-h4">{m.label}</span>
                      {m.done && (
                        <span
                          className="badge"
                          style={{
                            background: "rgba(60, 200, 121, 0.18)",
                            color: "#1F6A3F",
                          }}
                        >
                          ✓ Validée
                        </span>
                      )}
                    </div>
                    <p
                      className="text-small mt-1"
                      style={{ color: "var(--color-gray)" }}
                    >
                      {m.description}
                    </p>
                    <div className="mt-3">
                      <div
                        className="h-1.5 rounded-full overflow-hidden"
                        style={{ background: "rgba(139, 127, 163, 0.18)" }}
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (m.current / m.target) * 100)}%`,
                            background: m.done
                              ? "var(--color-green)"
                              : "var(--color-purple)",
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span
                          className="text-meta"
                          style={{ color: "var(--color-gray)" }}
                        >
                          {m.current}/{m.target}
                        </span>
                        <span
                          className="text-meta font-bold"
                          style={{
                            color: m.done
                              ? "var(--color-green)"
                              : "var(--color-purple)",
                            letterSpacing: "0.05em",
                          }}
                        >
                          +{m.xpReward} XP
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

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
          title={isManager ? "L'équipe en action" : "Tes derniers appels"}
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
              const authorProfile = profileById.get(s.user_id);
              const author = authorProfile?.full_name ?? "Anonyme";
              const authorAvatar = authorProfile?.avatar_url ?? null;
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
                      <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                        {isManager && (
                          <Avatar src={authorAvatar} name={author} size={36} />
                        )}
                        <div className="flex-1 min-w-0">
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

interface PlayerCardProps {
  level: number;
  xpTotal: number;
  xpInLevel: number;
  xpToNext: number;
  xpForNextLevel: number;
  progressPct: number;
  rankLabel: string;
  rankPrimary: string;
  rankSecondary: string;
  rankGlow: string;
  nextRankLabel: string | null;
  nextRankAtLevel: number | null;
}

function PlayerCard({
  level,
  xpTotal,
  xpInLevel,
  xpToNext,
  xpForNextLevel,
  progressPct,
  rankLabel,
  rankPrimary,
  rankSecondary,
  rankGlow,
  nextRankLabel,
  nextRankAtLevel,
}: PlayerCardProps) {
  return (
    <Card variant="dark">
      <div className="flex items-center gap-6 flex-wrap">
        <div
          className="rounded-full flex flex-col items-center justify-center shrink-0"
          style={{
            width: 96,
            height: 96,
            background: `linear-gradient(135deg, ${rankPrimary} 0%, ${rankSecondary} 100%)`,
            boxShadow: `0 0 0 4px ${rankGlow}, 0 0 0 8px rgba(255,255,255,0.06)`,
            color: "#FFFFFF",
          }}
        >
          <span
            className="text-meta uppercase tracking-widest"
            style={{ color: "rgba(255,255,255,0.85)", fontWeight: 700, fontSize: "0.62rem" }}
          >
            Niveau
          </span>
          <span
            style={{
              fontFamily: "var(--font-ubuntu), Lato, system-ui, sans-serif",
              fontSize: "2.4rem",
              fontWeight: 700,
              lineHeight: "1",
              letterSpacing: "-0.02em",
            }}
          >
            {level}
          </span>
        </div>
        <div className="flex-1 min-w-[260px]">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <span
              className="px-3 py-1 rounded-full text-meta uppercase tracking-widest"
              style={{
                background: `linear-gradient(135deg, ${rankPrimary}33, ${rankSecondary}22)`,
                border: `1px solid ${rankPrimary}66`,
                color: rankPrimary,
                fontWeight: 700,
                fontSize: "0.68rem",
              }}
            >
              Rang {rankLabel}
            </span>
            <span
              className="text-small"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              {xpTotal.toLocaleString("fr-FR")} XP cumulés
            </span>
          </div>
          <div className="flex items-baseline justify-between mb-2">
            <span
              className="text-small"
              style={{ color: "rgba(255,255,255,0.85)", fontWeight: 600 }}
            >
              {xpInLevel}/{xpForNextLevel} XP
            </span>
            <span
              className="text-small"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              Plus que {xpToNext} XP avant niveau {level + 1}
            </span>
          </div>
          <div
            className="h-3 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${progressPct}%`,
                background: `linear-gradient(90deg, ${rankPrimary}, ${rankSecondary})`,
                boxShadow: `0 0 12px ${rankGlow}`,
                transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            />
          </div>
          {nextRankLabel && nextRankAtLevel && (
            <p
              className="text-meta mt-2"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              Rang {nextRankLabel} débloqué au niveau {nextRankAtLevel}.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
