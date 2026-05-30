"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { TrainingModeBadge } from "@/components/TrainingModeBadge";
import { formatRelativeFr } from "@/lib/format";
import { computeStats } from "@/lib/badges";
import { rankFromPpn, totalPpn } from "@/lib/ranks";
import type { SessionRow } from "@/lib/supabase/types";

interface Profile {
  full_name: string;
  avatar_url: string | null;
}

interface Props {
  sessions: SessionRow[];
  clientById: Record<string, { name: string; sector: string | null }>;
  profileById: Record<string, Profile>;
  myUserId: string | null;
}

type Period = "week" | "month" | "all";
type SortKey = "rdv" | "sessions" | "score" | "ppn";

const PERIOD_LABELS: Record<Period, string> = {
  week: "7 derniers jours",
  month: "30 derniers jours",
  all: "Depuis le début",
};

const SORT_LABELS: Record<SortKey, string> = {
  rdv: "RDV décrochés",
  sessions: "Appels menés",
  score: "Score moyen",
  ppn: "Rang (PPN)",
};

function startOfPeriod(period: Period): Date | null {
  if (period === "all") return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "week") d.setDate(d.getDate() - 7);
  else d.setDate(d.getDate() - 30);
  return d;
}

interface PlayerRow {
  userId: string;
  name: string;
  avatar: string | null;
  ppn: number;
  rankLabel: string;
  rankPrimary: string;
  rankGlow: string;
  globalIndex: number;
  // période courante
  sessions: number;
  rdv: number;
  rdvRate: number;
  avgScore: number | null;
  // période précédente (pour trend)
  prevSessions: number;
  prevRdv: number;
  prevAvgScore: number | null;
  streak: number;
  lastSession: SessionRow | null;
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

export function TeamLeaderboard({
  sessions,
  clientById,
  profileById,
  myUserId,
}: Props) {
  const [period, setPeriod] = useState<Period>("month");
  const [sortBy, setSortBy] = useState<SortKey>("rdv");

  const rows: PlayerRow[] = useMemo(() => {
    const start = startOfPeriod(period);
    const periodStartMs = start ? start.getTime() : 0;
    // période précédente pour la tendance : même longueur que la période courante
    const periodSpanMs = start
      ? Date.now() - start.getTime()
      : 1000 * 60 * 60 * 24 * 30;
    const prevStartMs = periodStartMs - periodSpanMs;

    const byUser = new Map<string, SessionRow[]>();
    for (const s of sessions) {
      const arr = byUser.get(s.user_id) ?? [];
      arr.push(s);
      byUser.set(s.user_id, arr);
    }

    const result: PlayerRow[] = [];
    for (const [userId, allUserSessions] of byUser) {
      // Pour le rang on prend TOUTES les sessions (PPN cumulé global)
      const ppn = totalPpn(allUserSessions);
      const rank = rankFromPpn(ppn);

      // Stats de la période courante
      const currentPeriodSessions = allUserSessions.filter(
        (s) => new Date(s.started_at).getTime() >= periodStartMs,
      );
      const currentCompleted = currentPeriodSessions.filter(
        (s) => s.status === "completed",
      );
      const currentStats = computeStats(currentPeriodSessions);

      // Période précédente
      const prevPeriodSessions = allUserSessions.filter((s) => {
        const t = new Date(s.started_at).getTime();
        return t >= prevStartMs && t < periodStartMs;
      });
      const prevStats = computeStats(prevPeriodSessions);

      const lastSession = allUserSessions[0] ?? null; // already ordered desc

      result.push({
        userId,
        name: profileById[userId]?.full_name ?? "Anonyme",
        avatar: profileById[userId]?.avatar_url ?? null,
        ppn,
        rankLabel: rank.label,
        rankPrimary: rank.primary,
        rankGlow: rank.glow,
        globalIndex: rank.globalIndex,
        sessions: currentCompleted.length,
        rdv: currentStats.rdvCount,
        rdvRate: currentStats.rdvRate,
        avgScore: currentStats.avgScore,
        prevSessions: prevStats.completedSessions,
        prevRdv: prevStats.rdvCount,
        prevAvgScore: prevStats.avgScore,
        streak: computeStreak(allUserSessions),
        lastSession,
      });
    }

    // Tri
    result.sort((a, b) => {
      if (sortBy === "rdv") return b.rdv - a.rdv;
      if (sortBy === "sessions") return b.sessions - a.sessions;
      if (sortBy === "score") return (b.avgScore ?? 0) - (a.avgScore ?? 0);
      return b.ppn - a.ppn;
    });

    return result;
  }, [sessions, profileById, period, sortBy]);

  // Hero stats globales (sur la période)
  const heroStats = useMemo(() => {
    const start = startOfPeriod(period);
    const periodSessions = start
      ? sessions.filter(
          (s) => new Date(s.started_at).getTime() >= start.getTime(),
        )
      : sessions;
    const completed = periodSessions.filter((s) => s.status === "completed");
    const rdv = completed.filter((s) => s.appointment_secured).length;
    const scores = completed
      .map((s) => s.score)
      .filter((s): s is number => typeof s === "number");
    const avg =
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null;
    const topPerformer =
      rows.length > 0 && rows[0]!.sessions > 0 ? rows[0] : null;
    return {
      total: completed.length,
      rdv,
      avg,
      topPerformer,
      activePlayers: rows.filter((r) => r.sessions > 0).length,
    };
  }, [sessions, period, rows]);

  const recentSessions = sessions.slice(0, 6);

  return (
    <div className="space-y-8">
      {/* Période + sort */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className="px-4 py-2 rounded-full text-small font-semibold transition"
              style={{
                background:
                  period === p
                    ? "rgba(60, 200, 121, 0.20)"
                    : "rgba(255, 255, 255, 0.05)",
                border:
                  period === p
                    ? "1px solid rgba(60, 200, 121, 0.55)"
                    : "1px solid rgba(255, 255, 255, 0.10)",
                color:
                  period === p ? "var(--color-green)" : "rgba(255,255,255,0.75)",
              }}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-meta uppercase tracking-widest"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Tri
          </span>
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSortBy(k)}
              className="px-3 py-1.5 rounded-full text-meta font-semibold uppercase tracking-widest transition"
              style={{
                background:
                  sortBy === k
                    ? "rgba(157, 107, 255, 0.20)"
                    : "transparent",
                border:
                  sortBy === k
                    ? "1px solid rgba(157, 107, 255, 0.55)"
                    : "1px solid rgba(255, 255, 255, 0.10)",
                color: sortBy === k ? "#b495ff" : "rgba(255,255,255,0.6)",
                letterSpacing: "0.16em",
                fontSize: "0.62rem",
              }}
            >
              {SORT_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      {/* Hero stats équipe */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroStat
          label="Appels menés"
          value={heroStats.total.toString()}
          accent="#3CC879"
          icon="📞"
        />
        <HeroStat
          label="RDV décrochés"
          value={heroStats.rdv.toString()}
          accent="#F7C041"
          icon="🎯"
        />
        <HeroStat
          label="Score moyen"
          value={heroStats.avg !== null ? `${heroStats.avg}/100` : "·"}
          accent="#9d6bff"
          icon="⭐"
        />
        <HeroStat
          label="Joueurs actifs"
          value={`${heroStats.activePlayers} / ${rows.length}`}
          accent="#4A8FE7"
          icon="👥"
        />
      </section>

      {heroStats.topPerformer && (
        <TopPerformer player={heroStats.topPerformer} />
      )}

      {/* Grille des joueurs */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <h2 className="text-h3" style={{ color: "#FFFFFF" }}>
            L&apos;équipe en détail
          </h2>
          <span
            className="text-small"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Trié par {SORT_LABELS[sortBy]} · {PERIOD_LABELS[period]}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rows.map((r, idx) => (
            <PlayerCard
              key={r.userId}
              row={r}
              rank={idx + 1}
              isMe={r.userId === myUserId}
              periodLabel={PERIOD_LABELS[period].toLowerCase()}
            />
          ))}
        </div>
      </section>

      {/* Sessions récentes équipe */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <h2 className="text-h3" style={{ color: "#FFFFFF" }}>
            Sessions récentes
          </h2>
        </div>
        <div className="space-y-2">
          {recentSessions.map((s) => {
            const client = s.client_id ? clientById[s.client_id] : null;
            const author = profileById[s.user_id];
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
                className="ui-card ui-card-padded ui-card-hover flex items-center gap-3 flex-wrap"
                style={{ textDecoration: "none", padding: "12px 16px" }}
              >
                <Avatar
                  src={author?.avatar_url ?? null}
                  name={author?.full_name ?? "Anonyme"}
                  size={32}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      style={{
                        color: "#FFFFFF",
                        fontWeight: 600,
                        fontSize: "0.9rem",
                      }}
                    >
                      {author?.full_name ?? "Anonyme"}
                    </span>
                    <span
                      style={{
                        color: "rgba(255, 255, 255, 0.5)",
                        fontSize: "0.8rem",
                      }}
                    >
                      · {clientName} · {s.persona_label}
                    </span>
                  </div>
                  <div
                    style={{
                      color: "rgba(255, 255, 255, 0.45)",
                      fontSize: "0.72rem",
                      letterSpacing: "0.05em",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span>{formatRelativeFr(s.started_at)}</span>
                    {s.appointment_secured && <span>· ✓ RDV</span>}
                    <TrainingModeBadge
                      mode={s.training_mode}
                      blockTarget={s.block_target}
                      embeddedBlocksCount={s.embedded_blocks_count}
                      compact
                    />
                  </div>
                </div>
                <ScorePill score={s.score} />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// =================== Sous-composants ===================

function HeroStat({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent: string;
  icon: string;
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: `linear-gradient(140deg, ${accent}1f 0%, rgba(34, 25, 50, 0.5) 100%)`,
        border: `1px solid ${accent}55`,
        backdropFilter: "blur(16px) saturate(160%)",
      }}
    >
      <div
        style={{
          color: accent,
          fontSize: "0.65rem",
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          marginBottom: 8,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span aria-hidden="true">{icon}</span>
        {label}
      </div>
      <div
        style={{
          color: "#FFFFFF",
          fontFamily: "var(--font-ubuntu), Lato, sans-serif",
          fontSize: "2.2rem",
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TopPerformer({ player }: { player: PlayerRow }) {
  return (
    <div
      className="rounded-xl p-5 flex items-center gap-5 flex-wrap"
      style={{
        background:
          "linear-gradient(140deg, rgba(247, 192, 65, 0.18) 0%, rgba(34, 25, 50, 0.5) 100%)",
        border: "1px solid rgba(247, 192, 65, 0.40)",
        backdropFilter: "blur(16px) saturate(160%)",
      }}
    >
      <span style={{ fontSize: "2rem" }} aria-hidden="true">🏆</span>
      <div className="flex items-center gap-3">
        <Avatar src={player.avatar} name={player.name} size={48} ring />
        <div>
          <div
            style={{
              color: "#F7C041",
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            Top performer
          </div>
          <div
            style={{
              color: "#FFFFFF",
              fontSize: "1.2rem",
              fontWeight: 700,
              lineHeight: 1.2,
            }}
          >
            {player.name}
          </div>
          <div
            style={{
              color: "rgba(255, 255, 255, 0.7)",
              fontSize: "0.85rem",
              marginTop: 2,
            }}
          >
            {player.sessions} appels · {player.rdv} RDV ·{" "}
            {player.avgScore !== null ? `${player.avgScore}/100` : "·"}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerCard({
  row,
  rank,
  isMe,
  periodLabel,
}: {
  row: PlayerRow;
  rank: number;
  isMe: boolean;
  periodLabel: string;
}) {
  // Tendance vs période précédente : RDV ou sessions
  const sessionsDiff = row.sessions - row.prevSessions;
  const rdvDiff = row.rdv - row.prevRdv;
  const trend =
    rdvDiff > 0 || sessionsDiff > 0
      ? "up"
      : rdvDiff < 0 || sessionsDiff < 0
        ? "down"
        : "flat";
  const trendColor =
    trend === "up" ? "#3CC879" : trend === "down" ? "#FFB4B4" : "#9A9AAA";

  const inactive = row.sessions === 0;

  const lastSessionDate = row.lastSession
    ? formatRelativeFr(row.lastSession.started_at)
    : "·";

  return (
    <Link
      href={`/history/${row.userId}`}
      className="ui-card ui-card-padded ui-card-hover block"
      style={{
        textDecoration: "none",
        opacity: inactive ? 0.6 : 1,
        position: "relative",
      }}
    >
      {/* Rank chip */}
      <span
        className="absolute"
        style={{
          top: 14,
          right: 14,
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "rgba(255, 255, 255, 0.08)",
          color: "rgba(255, 255, 255, 0.85)",
          fontSize: "0.7rem",
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        #{rank}
      </span>

      <div className="flex items-center gap-4 mb-4">
        <Avatar src={row.avatar} name={row.name} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              style={{
                color: "#FFFFFF",
                fontSize: "1.05rem",
                fontWeight: 700,
              }}
            >
              {row.name}
            </span>
            {isMe && (
              <span
                style={{
                  background: "rgba(60, 200, 121, 0.20)",
                  color: "var(--color-green)",
                  padding: "1px 8px",
                  borderRadius: 999,
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                }}
              >
                Toi
              </span>
            )}
          </div>
          <div
            className="flex items-center gap-2 flex-wrap mt-1"
            style={{ fontSize: "0.78rem" }}
          >
            <span
              style={{
                color: row.rankPrimary,
                fontWeight: 700,
                letterSpacing: "0.05em",
              }}
            >
              {row.rankLabel}
            </span>
            <span style={{ color: "rgba(255,255,255,0.4)" }}>·</span>
            <span style={{ color: "rgba(255,255,255,0.55)" }}>
              {row.ppn.toLocaleString("fr-FR")} PPN
            </span>
            {row.streak > 0 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  color: "#F7C041",
                  fontWeight: 700,
                }}
              >
                🔥 {row.streak}j
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats grille */}
      <div
        className="grid grid-cols-3 gap-2 mb-3"
        style={{
          padding: "12px 8px",
          background: "rgba(255, 255, 255, 0.03)",
          borderRadius: 10,
        }}
      >
        <Metric label="Appels" value={row.sessions.toString()} />
        <Metric
          label="RDV"
          value={row.rdv.toString()}
          highlight={row.rdv > 0}
        />
        <Metric
          label="Score"
          value={row.avgScore !== null ? `${row.avgScore}` : "·"}
        />
      </div>

      {/* Trend + last activity */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span
          style={{
            fontSize: "0.72rem",
            color: "rgba(255, 255, 255, 0.5)",
            letterSpacing: "0.05em",
          }}
        >
          Dernière activité : {lastSessionDate}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: "0.72rem",
            color: trendColor,
            fontWeight: 700,
          }}
        >
          {trend === "up" && (
            <>
              ↑ +{Math.max(rdvDiff, sessionsDiff)} vs {periodLabel.split(" ").pop()}
            </>
          )}
          {trend === "down" && (
            <>
              ↓ {rdvDiff !== 0 ? rdvDiff : sessionsDiff} vs{" "}
              {periodLabel.split(" ").pop()}
            </>
          )}
          {trend === "flat" && <>= stable</>}
        </span>
      </div>
    </Link>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <div
        style={{
          color: "rgba(255, 255, 255, 0.45)",
          fontSize: "0.6rem",
          letterSpacing: "0.18em",
          fontWeight: 700,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: highlight ? "var(--color-green)" : "#FFFFFF",
          fontFamily: "var(--font-ubuntu), Lato, sans-serif",
          fontSize: "1.4rem",
          fontWeight: 700,
          lineHeight: 1,
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ScorePill({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return (
      <span
        style={{
          background: "rgba(255, 255, 255, 0.06)",
          color: "rgba(255, 255, 255, 0.45)",
          padding: "4px 12px",
          borderRadius: 999,
          fontSize: "0.85rem",
          fontWeight: 700,
        }}
      >
        ·
      </span>
    );
  }
  const color =
    score >= 75
      ? "var(--color-green)"
      : score >= 50
        ? "#b495ff"
        : score >= 30
          ? "#F7C041"
          : "#FFB4B4";
  return (
    <span
      style={{
        background: `${color}1f`,
        color,
        padding: "4px 12px",
        borderRadius: 999,
        fontSize: "0.85rem",
        fontWeight: 700,
        fontFamily: "var(--font-ubuntu), Lato, sans-serif",
      }}
    >
      {score}/100
    </span>
  );
}
