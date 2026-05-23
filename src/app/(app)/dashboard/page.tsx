import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { CamilleMascot } from "@/components/CamilleMascot";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formatRelativeFr } from "@/lib/format";
import type { Client, SessionRow, UserRole } from "@/lib/supabase/types";
import {
  filterTodaysSessions,
  pickDailyMissions,
} from "@/lib/daily-missions";
import {
  totalPpn,
  rankProgress,
  ppnForSession,
  MONTHLY_REWARDS,
  RANK_TIERS,
} from "@/lib/ranks";

export const dynamic = "force-dynamic";

const DAILY_TARGET_MINUTES = 30;

export default async function DashboardPage() {
  const supabase = await createClient();
  const configured = isSupabaseConfigured();

  let myAllSessions: SessionRow[] = [];
  let teamSessions: SessionRow[] = [];
  let clients: Pick<Client, "id" | "name" | "sector">[] = [];
  let profileById = new Map<
    string,
    { full_name: string; avatar_url: string | null }
  >();
  let userName = "Commercial";
  let myUserId: string | null = null;
  let myAvatarUrl: string | null = null;
  let role: UserRole = "commercial";

  if (configured) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      myUserId = user.id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, first_name, role, avatar_url")
        .eq("id", user.id)
        .single();
      const p = profile as {
        full_name?: string | null;
        first_name?: string | null;
        role?: UserRole;
        avatar_url?: string | null;
      } | null;
      myAvatarUrl = p?.avatar_url ?? null;
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
          .limit(12),
        supabase
          .from("clients")
          .select("id, name, sector")
          .eq("active", true)
          .order("name", { ascending: true }),
        supabase.from("profiles").select("id, full_name, avatar_url"),
      ]);

      myAllSessions = (myAllSessionsData ?? []) as SessionRow[];
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
  const isManager =
    role === "manager" || role === "org_admin" || role === "platform_admin";

  // ---------- Stats perso ----------
  const completed = myAllSessions.filter((s) => s.status === "completed");
  const rdvSecured = completed.filter((s) => s.appointment_secured).length;
  const rdvRate =
    completed.length > 0 ? Math.round((rdvSecured / completed.length) * 100) : 0;

  // ---------- Gamification (système de rangs PPN) ----------
  const ppnTotal = totalPpn(myAllSessions);
  const rank = rankProgress(ppnTotal);
  // Dernière session pour afficher le delta PPN éventuel
  const lastCompletedSession = myAllSessions.find(
    (s) => s.status === "completed",
  );
  const lastPpnDelta = lastCompletedSession
    ? ppnForSession(lastCompletedSession).total
    : 0;

  // ---------- Today / streak ----------
  const todaySessions = filterTodaysSessions(myAllSessions);
  const minutesToday = minutesPracticedToday(myAllSessions);
  const streakDays = computeStreak(myAllSessions);

  // ---------- Daily missions ----------
  const dailyMissions = myUserId
    ? pickDailyMissions(myUserId, todaySessions)
    : [];
  const dailyDone = dailyMissions.filter((m) => m.done).length;

  // ---------- Live team feed ----------
  const liveFeed = teamSessions
    .filter((s) => s.status === "completed")
    .slice(0, 6);

  return (
    <div className="container-noxias py-10 space-y-10">
        {/* HERO + QUICK CTA */}
        <header className="flex items-end justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-5">
            {myAvatarUrl ? (
              <div
                className="rounded-full"
                style={{
                  width: 86,
                  height: 86,
                  padding: 3,
                  background:
                    "linear-gradient(135deg, var(--color-green) 0%, rgba(60,200,121,0.2) 100%)",
                  boxShadow: "0 0 0 4px rgba(60, 200, 121, 0.12), 0 12px 30px rgba(60, 200, 121, 0.32)",
                }}
              >
                <Avatar src={myAvatarUrl} name={userName} size={80} />
              </div>
            ) : (
              <CamilleMascot
                state={
                  minutesToday >= DAILY_TARGET_MINUTES ? "happy" : "idle"
                }
                size={86}
                withHalo
              />
            )}
            <div>
              <span className="mission-classified">
                <DotPulse />
                {myAvatarUrl ? "MISSION CONTROL" : "CAMILLE · TON COACH"}
              </span>
              <h1 className="mission-h1 mt-3">
                <span style={{ color: "rgba(255,255,255,0.85)" }}>
                  Salut{" "}
                </span>
                <span className="accent">{userName}</span>
                <span style={{ color: "rgba(255,255,255,0.85)" }}>.</span>
              </h1>
              <p className="mission-subtitle">
                {streakDays > 1
                  ? `${streakDays} jours d'affilée. On continue ?`
                  : minutesToday >= DAILY_TARGET_MINUTES
                    ? "Quota du jour bouclé. Tu peux pousser plus."
                    : minutesToday > 0
                      ? `${minutesToday} min déjà aujourd'hui. ${DAILY_TARGET_MINUTES - minutesToday} min pour boucler ton quota.`
                      : "Prêt pour exploser les compteurs."}
              </p>
            </div>
          </div>
          <div className="flex gap-3 shrink-0 flex-wrap">
            <Link href="/clients" className="mission-cta mission-cta-ghost">
              Mes clients
            </Link>
            <Link href="/sessions/new" className="mission-cta">
              Lancer une mission →
            </Link>
          </div>
        </header>

        {/* MISSION CONTROL HQ : Rank + Daily progress */}
        <section className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5">
          <RankCard
            rank={rank}
            lastPpnDelta={lastPpnDelta}
          />
          <DailyProgressCard
            minutesToday={minutesToday}
            target={DAILY_TARGET_MINUTES}
            streakDays={streakDays}
            sessionsToday={todaySessions.length}
          />
        </section>

        {/* DAILY MISSIONS */}
        {dailyMissions.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <span className="mission-eyebrow mission-eyebrow-orange">
                  Missions du jour
                </span>
                <h2 className="mission-h1" style={{ fontSize: "1.6rem" }}>
                  Trois objectifs avant de partir prospecter.
                </h2>
              </div>
              <span
                className="text-small font-semibold"
                style={{
                  color:
                    dailyDone === dailyMissions.length
                      ? "var(--color-green)"
                      : "rgba(255,255,255,0.55)",
                }}
              >
                {dailyDone}/{dailyMissions.length} bouclées
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {dailyMissions.map((m) => (
                <DailyMissionCard
                  key={m.id}
                  icon={m.icon}
                  label={m.label}
                  description={m.description}
                  current={m.current}
                  target={m.target}
                  done={m.done}
                  xp={m.xpReward}
                />
              ))}
            </div>
          </section>
        )}

        {/* PALIERS DE RÉCOMPENSES */}
        <RewardsLadder currentRank={rank.globalIndex} />

        {/* CLIENTS / TERRAINS DE JEU */}
        {clients.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <span className="mission-eyebrow">Tes terrains de jeu</span>
                <h2 className="mission-h1" style={{ fontSize: "1.6rem" }}>
                  {clients.length} client{clients.length > 1 ? "s" : ""}{" "}
                  en pipeline.
                </h2>
              </div>
              {clients.length > 6 && (
                <Link href="/clients" className="mission-link">
                  Voir tous les clients →
                </Link>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clients.slice(0, 6).map((c) => (
                <Link key={c.id} href={`/clients/${c.id}`}>
                  <div className="mission-card mission-card-hover h-full">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div
                          className="text-h4"
                          style={{ color: "#FFFFFF" }}
                        >
                          {c.name}
                        </div>
                        {c.sector && (
                          <div
                            className="mission-tile-label mt-1"
                            style={{ color: "var(--color-green)" }}
                          >
                            {c.sector}
                          </div>
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
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* LIVE FEED ÉQUIPE */}
        {liveFeed.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <span className="mission-eyebrow mission-eyebrow-violet">
                  <DotPulse color="#9d6bff" />
                  Activité équipe en direct
                </span>
                <h2 className="mission-h1" style={{ fontSize: "1.6rem" }}>
                  {isManager
                    ? "L'équipe sur le terrain."
                    : "Les autres bossent. Tu fais quoi ?"}
                </h2>
              </div>
              <Link href="/history" className="mission-link">
                Tout l&apos;historique →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {liveFeed.map((s) => {
                const author = profileById.get(s.user_id);
                const name = author?.full_name ?? "Anonyme";
                const isMe = s.user_id === myUserId;
                return (
                  <Link
                    key={s.id}
                    href={`/sessions/${s.id}/feedback`}
                    className={`mission-feed-item mission-card-hover ${
                      s.appointment_secured ? "mission-feed-item-success" : ""
                    }`}
                    style={{ textDecoration: "none" }}
                  >
                    <Avatar
                      src={author?.avatar_url ?? null}
                      name={name}
                      size={36}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-small font-semibold"
                          style={{ color: "#FFFFFF" }}
                        >
                          {name}
                          {isMe && (
                            <span
                              className="ml-1.5"
                              style={{
                                color: "var(--color-green)",
                                fontSize: "0.65rem",
                                letterSpacing: "0.18em",
                              }}
                            >
                              · TOI
                            </span>
                          )}
                        </span>
                        {s.appointment_secured && (
                          <span
                            className="badge"
                            style={{
                              background: "rgba(60, 200, 121, 0.18)",
                              color: "var(--color-green)",
                            }}
                          >
                            ✓ RDV
                          </span>
                        )}
                      </div>
                      <p
                        className="text-meta truncate"
                        style={{ color: "rgba(255,255,255,0.55)" }}
                      >
                        {s.client_name_snapshot ?? "Client supprimé"} ·{" "}
                        {s.persona_label} ·{" "}
                        {formatRelativeFr(s.started_at)}
                      </p>
                    </div>
                    {typeof s.score === "number" && (
                      <span
                        className="mission-stat-num"
                        style={{
                          fontSize: "1.3rem",
                          color:
                            s.score >= 75
                              ? "var(--color-green)"
                              : s.score >= 50
                                ? "#b495ff"
                                : "#FFB4B4",
                        }}
                      >
                        {s.score}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        )}
    </div>
  );
}

// =================== Composants internes ===================

function RankCard({
  rank,
  lastPpnDelta,
}: {
  rank: {
    label: string;
    ppn: number;
    ppnInLevel: number;
    ppnToNext: number | null;
    ppnForCurrent: number;
    ppnForNext: number | null;
    progressPct: number;
    primary: string;
    secondary: string;
    glow: string;
    globalIndex: number;
    monthlyRewardEur: number;
    monthlyRewardLabel: string;
    monthlyRewardIcon: string;
  };
  lastPpnDelta: number;
}) {
  return (
    <div className="mission-card">
      <div className="flex items-center gap-6 flex-wrap">
        <RankShield
          primary={rank.primary}
          secondary={rank.secondary}
          glow={rank.glow}
          tierLabel={rank.label}
          size={108}
        />
        <div className="flex-1 min-w-[260px]">
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <span
              className="px-3 py-1 rounded-full"
              style={{
                background: `linear-gradient(135deg, ${rank.primary}33, ${rank.secondary}22)`,
                border: `1px solid ${rank.primary}66`,
                color: rank.primary,
                fontWeight: 700,
                fontSize: "0.68rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              Rang {rank.globalIndex} / 24
            </span>
            <span
              className="text-small"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              {rank.ppn.toLocaleString("fr-FR")} PPN cumulés
            </span>
            {lastPpnDelta !== 0 && (
              <span
                className="text-small"
                style={{
                  fontWeight: 700,
                  color: lastPpnDelta > 0 ? "var(--color-green)" : "#FFB4B4",
                }}
              >
                Dernier appel : {lastPpnDelta > 0 ? "+" : ""}
                {lastPpnDelta} PPN
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-3 flex-wrap mb-2">
            <h3
              className="text-h2"
              style={{
                color: rank.primary,
                fontSize: "2rem",
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              {rank.label}
            </h3>
            <span
              className="rounded-full px-2.5 py-1"
              style={{
                background: "rgba(60, 200, 121, 0.16)",
                border: "1px solid rgba(60, 200, 121, 0.40)",
                color: "var(--color-green)",
                fontWeight: 700,
                fontSize: "0.85rem",
              }}
              title="Récompense versée à la fin du mois si tu termines à ce rang"
            >
              {rank.monthlyRewardIcon} {rank.monthlyRewardLabel}
            </span>
          </div>
          <div className="flex items-baseline justify-between mb-2">
            <span
              className="text-small"
              style={{ color: "rgba(255,255,255,0.85)", fontWeight: 600 }}
            >
              {rank.ppnInLevel}
              {rank.ppnForNext !== null
                ? `/${rank.ppnForNext - rank.ppnForCurrent}`
                : ""}{" "}
              PPN
            </span>
            <span
              className="text-small"
              style={{ color: "rgba(255,255,255,0.55)" }}
            >
              {rank.ppnToNext !== null
                ? `Plus que ${rank.ppnToNext} PPN avant le rang suivant`
                : "Rang maximum atteint"}
            </span>
          </div>
          <div
            className="h-3 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.08)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${rank.progressPct}%`,
                background: `linear-gradient(90deg, ${rank.primary}, ${rank.secondary})`,
                boxShadow: `0 0 12px ${rank.glow}`,
                transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            />
          </div>
          <p
            className="text-meta mt-2"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            Un RDV = +30 PPN · Score parfait = +20 PPN · Raccrochage = −10 PPN.
            Cadeau de fin de mois selon ton rang final (du café au resto gastro).
          </p>
        </div>
      </div>
    </div>
  );
}

function RankShield({
  primary,
  secondary,
  glow,
  tierLabel,
  size = 96,
}: {
  primary: string;
  secondary: string;
  glow: string;
  tierLabel: string;
  size?: number;
}) {
  // Petit shield SVG inline qui reflète la tier
  return (
    <div
      className="shrink-0 relative"
      style={{
        width: size,
        height: size,
        filter: `drop-shadow(0 12px 28px ${glow})`,
      }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <linearGradient id={`shield-${primary}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={primary} />
            <stop offset="100%" stopColor={secondary} />
          </linearGradient>
        </defs>
        <path
          d="M 50 6 L 86 18 L 86 52 Q 86 78 50 94 Q 14 78 14 52 L 14 18 Z"
          fill={`url(#shield-${primary})`}
        />
        <path
          d="M 50 12 L 80 22 L 80 52 Q 80 74 50 88 Q 20 74 20 52 L 20 22 Z"
          fill="none"
          stroke="rgba(255,255,255,0.20)"
          strokeWidth="1.5"
        />
        <ellipse cx="50" cy="32" rx="22" ry="8" fill="rgba(255,255,255,0.18)" />
        <text
          x="50"
          y="62"
          textAnchor="middle"
          fill="rgba(255,255,255,0.95)"
          fontSize="11"
          fontWeight="800"
          letterSpacing="2"
          style={{
            textTransform: "uppercase",
            fontFamily: "var(--font-ubuntu), Lato, sans-serif",
          }}
        >
          {tierLabel.split(" ")[0]}
        </text>
        <text
          x="50"
          y="78"
          textAnchor="middle"
          fill="rgba(255,255,255,0.95)"
          fontSize="14"
          fontWeight="800"
          style={{ fontFamily: "var(--font-ubuntu), Lato, sans-serif" }}
        >
          {tierLabel.split(" ")[1] ?? ""}
        </text>
      </svg>
    </div>
  );
}

function DailyProgressCard({
  minutesToday,
  target,
  streakDays,
  sessionsToday,
}: {
  minutesToday: number;
  target: number;
  streakDays: number;
  sessionsToday: number;
}) {
  const pct = Math.min(100, Math.round((minutesToday / target) * 100));
  const done = minutesToday >= target;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = done ? "var(--color-green)" : "#b495ff";

  return (
    <div className="mission-card">
      <span className="mission-eyebrow">Aujourd&apos;hui</span>
      <p
        className="mt-1"
        style={{
          fontFamily: "var(--font-ubuntu), Lato, sans-serif",
          fontSize: "1.2rem",
          fontWeight: 700,
          letterSpacing: "-0.01em",
          color: "#FFFFFF",
        }}
      >
        {done ? "Quota bouclé." : "Objectif 30 minutes"}
      </p>
      <div className="flex items-center gap-5 mt-4">
        <div className="mission-progress-ring shrink-0">
          <svg width="124" height="124">
            <circle
              cx="62"
              cy="62"
              r={radius}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="10"
              fill="none"
            />
            <circle
              cx="62"
              cy="62"
              r={radius}
              stroke={color}
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{
                transition: "stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                filter: `drop-shadow(0 0 8px ${color}55)`,
              }}
            />
          </svg>
          <div className="mission-progress-ring-inner">
            <span
              style={{
                fontFamily: "var(--font-ubuntu), Lato, sans-serif",
                fontSize: "1.6rem",
                fontWeight: 700,
                lineHeight: "1",
                color,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {minutesToday}
            </span>
            <span
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.55)",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              / {target} min
            </span>
          </div>
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {streakDays > 0 && (
              <span className="mission-streak">
                <FlameIcon />
                {streakDays} {streakDays > 1 ? "jours" : "jour"}
              </span>
            )}
            {sessionsToday > 0 && (
              <span
                className="mission-tile-label"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                {sessionsToday} appel{sessionsToday > 1 ? "s" : ""} aujourd&apos;hui
              </span>
            )}
          </div>
          <p
            className="text-small"
            style={{ color: "rgba(255,255,255,0.65)", lineHeight: "1.45" }}
          >
            {done
              ? "Tu peux partir prospecter sereinement."
              : `Encore ${target - minutesToday} min pour atteindre ton quota.`}
          </p>
        </div>
      </div>
    </div>
  );
}

function DailyMissionCard({
  icon,
  label,
  description,
  current,
  target,
  done,
  xp,
}: {
  icon: string;
  label: string;
  description: string;
  current: number;
  target: number;
  done: boolean;
  xp: number;
}) {
  const pct = Math.min(100, (current / target) * 100);
  return (
    <div
      className={`mission-card ${done ? "mission-card-accent" : ""}`}
      style={{ position: "relative" }}
    >
      <div className="flex items-start gap-3">
        <div
          className="text-3xl shrink-0"
          style={{
            filter: done ? "none" : "grayscale(0.4)",
            opacity: done ? 1 : 0.85,
          }}
          aria-hidden="true"
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-h4"
              style={{ color: "#FFFFFF" }}
            >
              {label}
            </span>
            {done && (
              <span
                className="badge"
                style={{
                  background: "rgba(60, 200, 121, 0.22)",
                  color: "var(--color-green)",
                  fontWeight: 700,
                }}
              >
                ✓ Validée
              </span>
            )}
          </div>
          <p
            className="text-small mt-1"
            style={{ color: "rgba(255,255,255,0.65)", lineHeight: "1.45" }}
          >
            {description}
          </p>
          <div className="mt-3">
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: done ? "var(--color-green)" : "#b495ff",
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span
                className="text-meta"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                {current}/{target}
              </span>
              <span
                className="text-meta font-bold"
                style={{
                  color: done ? "var(--color-green)" : "#b495ff",
                  letterSpacing: "0.05em",
                }}
              >
                +{xp} XP
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DotPulse({ color = "#3CC879" }: { color?: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 0 0 ${color}88`,
        animation: "login-dot-pulse 1.6s ease-out infinite",
      }}
      aria-hidden="true"
    />
  );
}

function FlameIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2c1 4 4 6 4 10 0 3-2 6-4 6s-4-3-4-6c0-2 1-3 1-5 0 1 1 2 2 2 1 0 1-1 1-2 0-2 0-3 0-5z" />
    </svg>
  );
}

// =================== Helpers ===================

function minutesPracticedToday(sessions: SessionRow[]): number {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  let totalMs = 0;
  for (const s of sessions) {
    if (!s.ended_at) continue;
    const start = new Date(s.started_at);
    if (
      start.getFullYear() !== y ||
      start.getMonth() !== m ||
      start.getDate() !== d
    )
      continue;
    const end = new Date(s.ended_at);
    const diff = end.getTime() - start.getTime();
    if (diff > 0) totalMs += diff;
  }
  return Math.round(totalMs / 60000);
}

function computeStreak(sessions: SessionRow[]): number {
  const days = new Set<string>();
  for (const s of sessions) {
    if (s.status !== "completed") continue;
    const d = new Date(s.started_at);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  let streak = 0;
  const cur = new Date();
  cur.setHours(0, 0, 0, 0);
  // Si aujourd'hui sans pratique, on commence le compte à hier
  // (le streak n'est pas "cassé" tant qu'on n'a pas raté 1 jour entier)
  let key = `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`;
  if (!days.has(key)) {
    cur.setDate(cur.getDate() - 1);
  }
  while (true) {
    key = `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`;
    if (!days.has(key)) break;
    streak += 1;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

// =================== Paliers de récompenses ===================

function RewardsLadder({ currentRank }: { currentRank: number }) {
  // currentRank = 1..24
  // Le palier suivant à viser, et les 5 prochains
  const nextRank = Math.min(24, currentRank + 1);
  const visibleStart = Math.max(1, Math.min(nextRank, 21));
  const visibleRanks = Array.from({ length: 4 }, (_, i) => visibleStart + i);

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <span className="mission-eyebrow mission-eyebrow-orange">
            Tes prochains paliers
          </span>
          <h2 className="mission-h1" style={{ fontSize: "1.6rem" }}>
            Tes cadeaux de fin de mois selon ton rang.
          </h2>
        </div>
        <span
          className="text-small"
          style={{ color: "rgba(255, 255, 255, 0.55)" }}
        >
          Tu es au rang {currentRank}/24
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {visibleRanks.map((idx) => {
          const reward = MONTHLY_REWARDS[idx - 1];
          if (!reward) return null;
          const tierIndex = Math.floor((idx - 1) / 4);
          const subLevel = ((idx - 1) % 4) + 1;
          const tier = RANK_TIERS[tierIndex]!;
          const roman = ["I", "II", "III", "IV"][subLevel - 1];
          const isCurrent = idx === currentRank;
          const isReachable = idx <= currentRank;
          return (
            <div
              key={idx}
              className="rounded-xl p-4 transition-all"
              style={{
                background: isCurrent
                  ? `linear-gradient(140deg, ${tier.primary}30 0%, rgba(34, 25, 50, 0.5) 100%)`
                  : "rgba(255, 255, 255, 0.04)",
                border: `1px solid ${
                  isCurrent
                    ? tier.primary
                    : isReachable
                      ? `${tier.primary}55`
                      : "rgba(255, 255, 255, 0.08)"
                }`,
                opacity: isReachable ? 1 : 0.85,
                backdropFilter: "blur(16px) saturate(160%)",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="px-2 py-0.5 rounded-full"
                  style={{
                    background: `${tier.primary}22`,
                    border: `1px solid ${tier.primary}66`,
                    color: tier.primary,
                    fontSize: "0.6rem",
                    letterSpacing: "0.18em",
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  {tier.label} {roman}
                </span>
                {isCurrent && (
                  <span
                    className="text-meta"
                    style={{
                      color: "var(--color-green)",
                      fontWeight: 700,
                      fontSize: "0.6rem",
                      letterSpacing: "0.18em",
                    }}
                  >
                    ACTUEL
                  </span>
                )}
              </div>
              <div className="flex items-start gap-3 mt-3">
                <span
                  className="rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    width: 48,
                    height: 48,
                    background: `${tier.primary}1f`,
                    fontSize: "1.6rem",
                  }}
                  aria-hidden="true"
                >
                  {reward.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-small"
                    style={{
                      color: "#FFFFFF",
                      fontWeight: 600,
                      lineHeight: "1.3",
                    }}
                  >
                    {reward.label}
                  </p>
                  <p
                    className="text-meta mt-1"
                    style={{
                      color: "rgba(255, 255, 255, 0.5)",
                      letterSpacing: "0.05em",
                    }}
                  >
                    ≈ {reward.approxValueEur} € · Rang {idx}/24
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p
        className="text-meta"
        style={{ color: "rgba(255, 255, 255, 0.5)" }}
      >
        Le cadeau est versé à la fin du mois selon ton rang final. Plus tu
        grimpes, plus le cadeau est gros.
      </p>
    </section>
  );
}
