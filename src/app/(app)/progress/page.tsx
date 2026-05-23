import { redirect } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Medal, rarityColors, rarityLabel } from "@/components/ui/Medal";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  computeBadges,
  computeStats,
} from "@/lib/badges";
import { totalPpn, rankProgress } from "@/lib/ranks";
import type { SessionRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  if (!isSupabaseConfigured()) {
    redirect("/dashboard");
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: sessionsData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, first_name, avatar_url")
      .eq("id", user.id)
      .single(),
    supabase
      .from("sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false }),
  ]);

  const sessions = (sessionsData ?? []) as SessionRow[];
  const p = profile as {
    full_name: string | null;
    first_name: string | null;
    avatar_url: string | null;
  } | null;
  const firstName = p?.first_name?.trim() ?? p?.full_name?.split(" ")[0] ?? "Commercial";

  // Stats globales
  const stats = computeStats(sessions);
  const ppn = totalPpn(sessions);
  const rank = rankProgress(ppn);
  const badges = computeBadges(stats);
  const unlockedBadges = badges.filter((b) => b.unlocked);
  const lockedBadges = badges.filter((b) => !b.unlocked);

  // Stats semaine courante vs semaine précédente
  const now = Date.now();
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
  const thisWeek = sessions.filter(
    (s) => now - new Date(s.started_at).getTime() < ONE_WEEK,
  );
  const lastWeek = sessions.filter((s) => {
    const t = now - new Date(s.started_at).getTime();
    return t >= ONE_WEEK && t < 2 * ONE_WEEK;
  });
  const thisWeekStats = computeStats(thisWeek);
  const lastWeekStats = computeStats(lastWeek);

  // Records personnels
  const completed = sessions.filter((s) => s.status === "completed");
  const bestScore = completed.reduce(
    (best, s) => Math.max(best, s.score ?? 0),
    0,
  );
  const longestStreak = computeLongestStreak(completed);
  const sessionsByDay = groupByDay(completed);
  const bestDayCount = Object.values(sessionsByDay).reduce(
    (max, n) => Math.max(max, n),
    0,
  );

  // Score moyen sur les 14 derniers jours pour la sparkline
  const sparkData = lastNDaysScores(completed, 14);

  // Heatmap activité 28 derniers jours
  const heatmap = lastNDaysActivity(completed, 28);

  return (
    <div className="container-noxias py-10 space-y-10">
      {/* HERO */}
      <header className="flex items-center gap-5 flex-wrap">
        <Avatar src={p?.avatar_url ?? null} name={firstName} size={80} ring />
        <div>
          <div className="eyebrow-green">Ma progression</div>
          <h1
            className="text-h1"
            style={{
              fontSize: "clamp(2rem, 4vw, 2.8rem)",
              lineHeight: "1.05",
              color: "#FFFFFF",
            }}
          >
            Salut <span style={{ color: "var(--color-green)" }}>{firstName}</span>, voilà où tu en es.
          </h1>
          <p
            className="text-body mt-2"
            style={{ color: "rgba(255, 255, 255, 0.7)" }}
          >
            Ton rang, tes records et tes badges.
          </p>
        </div>
      </header>

      {/* RANG */}
      <section>
        <RankBlock rank={rank} />
      </section>

      {/* COMPARAISON SEMAINE */}
      <section>
        <h2 className="text-h3 mb-4" style={{ color: "#FFFFFF" }}>
          Cette semaine vs la précédente
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <CompareCard
            label="Appels"
            current={thisWeekStats.completedSessions}
            previous={lastWeekStats.completedSessions}
            accent="#3CC879"
          />
          <CompareCard
            label="RDV"
            current={thisWeekStats.rdvCount}
            previous={lastWeekStats.rdvCount}
            accent="#F7C041"
          />
          <CompareCard
            label="Score moyen"
            current={thisWeekStats.avgScore ?? 0}
            previous={lastWeekStats.avgScore ?? 0}
            suffix="/100"
            accent="#9d6bff"
          />
          <CompareCard
            label="Taux RDV"
            current={thisWeekStats.rdvRate}
            previous={lastWeekStats.rdvRate}
            suffix="%"
            accent="#4A8FE7"
          />
        </div>
      </section>

      {/* SPARKLINE + HEATMAP */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="ui-card ui-card-padded">
          <div className="eyebrow-green mb-3">Score moyen · 14 derniers jours</div>
          <ScoreSparkline data={sparkData} />
          <p
            className="text-meta mt-3"
            style={{ color: "rgba(255, 255, 255, 0.5)" }}
          >
            Les jours sans pratique sont en gris.
          </p>
        </div>
        <div className="ui-card ui-card-padded">
          <div className="eyebrow-green mb-3">Activité · 28 derniers jours</div>
          <Heatmap data={heatmap} />
          <p
            className="text-meta mt-3"
            style={{ color: "rgba(255, 255, 255, 0.5)" }}
          >
            Plus c&apos;est vert, plus tu as bossé ce jour-là.
          </p>
        </div>
      </section>

      {/* RECORDS PERSONNELS */}
      <section>
        <h2 className="text-h3 mb-4" style={{ color: "#FFFFFF" }}>
          Tes records personnels
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <RecordCard
            icon="⭐"
            label="Meilleur score"
            value={bestScore > 0 ? `${bestScore}/100` : "·"}
            accent="#F7C041"
          />
          <RecordCard
            icon="🔥"
            label="Plus longue série"
            value={`${longestStreak} ${longestStreak > 1 ? "jours" : "jour"}`}
            accent="#E94B4B"
          />
          <RecordCard
            icon="📞"
            label="Plus d'appels en 1 jour"
            value={bestDayCount.toString()}
            accent="#3CC879"
          />
          <RecordCard
            icon="🎯"
            label="RDV au total"
            value={stats.rdvCount.toString()}
            accent="#9d6bff"
          />
        </div>
      </section>

      {/* BADGES */}
      <section>
        <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-h3" style={{ color: "#FFFFFF" }}>
            Tes badges ({unlockedBadges.length}/{badges.length})
          </h2>
          <span
            className="text-small"
            style={{ color: "rgba(255, 255, 255, 0.55)" }}
          >
            Chaque badge débloqué te donne un bonus XP.
          </span>
        </div>
        {unlockedBadges.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
            {unlockedBadges.map((b) => (
              <BadgeRow key={b.id} badge={b} />
            ))}
          </div>
        )}

        {lockedBadges.length > 0 && (
          <>
            <h3
              className="text-small mb-3"
              style={{
                color: "rgba(255, 255, 255, 0.55)",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              À débloquer
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {lockedBadges.map((b) => (
                <BadgeRow key={b.id} badge={b} />
              ))}
            </div>
          </>
        )}
      </section>

      <div className="text-center pt-2">
        <Link href="/sessions/new" className="mission-cta">
          Lancer une mission maintenant →
        </Link>
      </div>
    </div>
  );
}

// =================== Sous-composants ===================

function RankBlock({
  rank,
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
  };
}) {
  return (
    <div className="ui-card ui-card-padded">
      <div className="flex items-center gap-5 flex-wrap">
        <div
          className="shrink-0 relative"
          style={{
            width: 108,
            height: 108,
            filter: `drop-shadow(0 12px 28px ${rank.glow})`,
          }}
        >
          <svg viewBox="0 0 100 100" width={108} height={108}>
            <defs>
              <linearGradient
                id={`progress-shield-${rank.primary}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={rank.primary} />
                <stop offset="100%" stopColor={rank.secondary} />
              </linearGradient>
            </defs>
            <path
              d="M 50 6 L 86 18 L 86 52 Q 86 78 50 94 Q 14 78 14 52 L 14 18 Z"
              fill={`url(#progress-shield-${rank.primary})`}
            />
            <ellipse
              cx="50"
              cy="32"
              rx="22"
              ry="8"
              fill="rgba(255,255,255,0.18)"
            />
            <text
              x="50"
              y="60"
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
              {rank.label.split(" ")[0]}
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
              {rank.label.split(" ")[1] ?? ""}
            </text>
          </svg>
        </div>
        <div className="flex-1 min-w-[220px]">
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
              style={{ color: "rgba(255, 255, 255, 0.55)" }}
            >
              {rank.ppn.toLocaleString("fr-FR")} PPN
            </span>
          </div>
          <h3
            className="text-h2 mb-3"
            style={{
              color: rank.primary,
              fontSize: "2.4rem",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            {rank.label}
          </h3>
          <div className="flex items-baseline justify-between mb-2">
            <span
              className="text-small"
              style={{ color: "#FFFFFF", fontWeight: 600 }}
            >
              {rank.ppnInLevel}
              {rank.ppnForNext !== null
                ? `/${rank.ppnForNext - rank.ppnForCurrent}`
                : ""}{" "}
              PPN
            </span>
            <span
              className="text-small"
              style={{ color: "rgba(255, 255, 255, 0.55)" }}
            >
              {rank.ppnToNext !== null
                ? `+${rank.ppnToNext} PPN avant le rang suivant`
                : "Rang maximum"}
            </span>
          </div>
          <div
            className="h-3 rounded-full overflow-hidden"
            style={{ background: "rgba(255, 255, 255, 0.08)" }}
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
        </div>
      </div>
    </div>
  );
}

function CompareCard({
  label,
  current,
  previous,
  suffix,
  accent,
}: {
  label: string;
  current: number;
  previous: number;
  suffix?: string;
  accent: string;
}) {
  const diff = current - previous;
  const trend = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const trendColor =
    trend === "up" ? "var(--color-green)" : trend === "down" ? "#FFB4B4" : "rgba(255,255,255,0.55)";
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
          fontSize: "0.62rem",
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span
          style={{
            color: "#FFFFFF",
            fontFamily: "var(--font-ubuntu), Lato, sans-serif",
            fontSize: "2rem",
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          {current}
          {suffix}
        </span>
      </div>
      <p
        className="text-meta mt-2"
        style={{ color: trendColor, fontWeight: 700, letterSpacing: "0.04em" }}
      >
        {trend === "up" && `↑ +${diff}${suffix ?? ""} vs S-1`}
        {trend === "down" && `↓ ${diff}${suffix ?? ""} vs S-1`}
        {trend === "flat" && `= stable vs S-1`}
      </p>
    </div>
  );
}

function RecordCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-xl p-5 flex items-center gap-4"
      style={{
        background: `linear-gradient(140deg, ${accent}1a 0%, rgba(34, 25, 50, 0.5) 100%)`,
        border: `1px solid ${accent}44`,
        backdropFilter: "blur(16px) saturate(160%)",
      }}
    >
      <span
        className="rounded-xl flex items-center justify-center shrink-0"
        style={{
          width: 48,
          height: 48,
          background: `${accent}22`,
          fontSize: "1.6rem",
        }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div
          style={{
            color: "rgba(255, 255, 255, 0.55)",
            fontSize: "0.62rem",
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
        <div
          style={{
            color: "#FFFFFF",
            fontFamily: "var(--font-ubuntu), Lato, sans-serif",
            fontSize: "1.4rem",
            fontWeight: 700,
            lineHeight: 1,
            marginTop: 4,
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

type BadgeForRow = ReturnType<typeof computeBadges>[number];
function BadgeRow({ badge }: { badge: BadgeForRow }) {
  const cfg = rarityColors(badge.rarity);
  return (
    <div className="ui-card ui-card-padded">
      <div className="flex items-start gap-3">
        <Medal
          icon={badge.icon}
          rarity={badge.rarity}
          size={56}
          locked={!badge.unlocked}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              style={{ color: "#FFFFFF", fontSize: "0.95rem", fontWeight: 700 }}
            >
              {badge.label}
            </span>
            <span
              style={{
                background: `${cfg.primary}28`,
                color: cfg.primary,
                fontSize: "0.55rem",
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                padding: "2px 8px",
                borderRadius: 999,
                border: `1px solid ${cfg.primary}55`,
              }}
            >
              {rarityLabel(badge.rarity)}
            </span>
          </div>
          <p
            style={{
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: "0.78rem",
              marginTop: 4,
              lineHeight: 1.4,
            }}
          >
            {badge.description}
          </p>
          {badge.progress && !badge.unlocked && (
            <>
              <div
                className="mt-2 h-1.5 rounded-full overflow-hidden"
                style={{ background: "rgba(255, 255, 255, 0.10)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      (badge.progress.current / badge.progress.target) * 100,
                    )}%`,
                    background: cfg.primary,
                  }}
                />
              </div>
              <p
                style={{
                  color: "rgba(255, 255, 255, 0.5)",
                  fontSize: "0.65rem",
                  marginTop: 4,
                  letterSpacing: "0.05em",
                }}
              >
                {badge.progress.current}/{badge.progress.target}
              </p>
            </>
          )}
          <p
            style={{
              color: badge.unlocked ? "var(--color-green)" : cfg.primary,
              fontSize: "0.65rem",
              marginTop: 6,
              fontWeight: 700,
              letterSpacing: "0.1em",
            }}
          >
            +{badge.xpReward} XP {badge.unlocked && "· débloqué"}
          </p>
        </div>
      </div>
    </div>
  );
}

function ScoreSparkline({ data }: { data: (number | null)[] }) {
  const width = 360;
  const height = 96;
  const pad = 4;
  const max = 100;
  const stepX = (width - 2 * pad) / Math.max(1, data.length - 1);

  const points = data
    .map((v, i) =>
      v === null
        ? null
        : { x: pad + i * stepX, y: pad + (1 - v / max) * (height - 2 * pad) },
    )
    .filter((p): p is { x: number; y: number } => p !== null);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      style={{ display: "block" }}
    >
      {/* Grille horizontale subtile */}
      {[0, 25, 50, 75, 100].map((v) => (
        <line
          key={v}
          x1={pad}
          x2={width - pad}
          y1={pad + (1 - v / max) * (height - 2 * pad)}
          y2={pad + (1 - v / max) * (height - 2 * pad)}
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth="1"
          strokeDasharray={v === 50 ? "" : "2 4"}
        />
      ))}
      {/* Points gris pour jours sans data */}
      {data.map((v, i) =>
        v === null ? (
          <circle
            key={`gap-${i}`}
            cx={pad + i * stepX}
            cy={height - pad}
            r="2"
            fill="rgba(255, 255, 255, 0.15)"
          />
        ) : null,
      )}
      {/* Ligne reliant les points */}
      {points.length > 1 && (
        <polyline
          fill="none"
          stroke="var(--color-green)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        />
      )}
      {/* Points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="3.5"
          fill="var(--color-green)"
          stroke="#14091f"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}

function Heatmap({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex flex-wrap gap-1.5">
      {data.map((d) => {
        const intensity = d.count === 0 ? 0 : Math.min(1, d.count / max);
        return (
          <span
            key={d.date}
            title={`${d.date} · ${d.count} appels`}
            style={{
              width: 24,
              height: 24,
              borderRadius: 5,
              background:
                d.count === 0
                  ? "rgba(255, 255, 255, 0.06)"
                  : `rgba(60, 200, 121, ${0.25 + intensity * 0.7})`,
              border: "1px solid rgba(255, 255, 255, 0.05)",
            }}
          />
        );
      })}
    </div>
  );
}

// =================== Helpers ===================

function lastNDaysScores(sessions: SessionRow[], n: number): (number | null)[] {
  // Score moyen par jour sur les N derniers jours
  const result: (number | null)[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    const sOfDay = sessions.filter((s) => {
      const t = new Date(s.started_at);
      return t >= day && t < next && typeof s.score === "number";
    });
    if (sOfDay.length === 0) {
      result.push(null);
    } else {
      const avg =
        sOfDay.reduce((a, b) => a + (b.score ?? 0), 0) / sOfDay.length;
      result.push(Math.round(avg));
    }
  }
  return result;
}

function lastNDaysActivity(
  sessions: SessionRow[],
  n: number,
): { date: string; count: number }[] {
  const result: { date: string; count: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    const count = sessions.filter((s) => {
      const t = new Date(s.started_at);
      return t >= day && t < next;
    }).length;
    result.push({
      date: day.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
      count,
    });
  }
  return result;
}

function computeLongestStreak(sessions: SessionRow[]): number {
  const days = new Set<string>();
  for (const s of sessions) {
    const d = new Date(s.started_at);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }
  const sortedDays = Array.from(days).sort();
  let longest = 0;
  let current = 0;
  let prev: Date | null = null;
  for (const k of sortedDays) {
    const [y, m, d] = k.split("-").map(Number);
    const cur = new Date(y!, m!, d!);
    if (prev) {
      const diff = (cur.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        current += 1;
      } else {
        current = 1;
      }
    } else {
      current = 1;
    }
    longest = Math.max(longest, current);
    prev = cur;
  }
  return longest;
}

function groupByDay(sessions: SessionRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sessions) {
    const d = new Date(s.started_at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}
