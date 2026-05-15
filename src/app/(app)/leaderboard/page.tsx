import { redirect } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { Medal, rarityColors, rarityLabel } from "@/components/ui/Medal";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  computeBadges,
  leaderboardScore,
  type UserStats,
} from "@/lib/badges";

export const dynamic = "force-dynamic";

interface LeaderboardRow {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "commercial" | "manager";
  total_sessions: number;
  completed_sessions: number;
  rdv_count: number;
  score_sum: number;
  perfect_scores: number;
  expert_sessions: number;
  distinct_clients: number;
  distinct_personas: number;
  days_active: number;
  best_score: number | null;
}

export default async function LeaderboardPage() {
  if (!isSupabaseConfigured()) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("get_leaderboard_stats");
  if (error) {
    return (
      <div className="container-noxias py-12">
        <h1 className="mission-h1">Classement</h1>
        <div className="mission-card mt-6">
          <p style={{ color: "#FFB4B4" }}>
            Impossible de charger le classement : {error.message}
          </p>
        </div>
      </div>
    );
  }

  const rows = ((data ?? []) as LeaderboardRow[]).filter(
    (r) => r.completed_sessions > 0,
  );

  const ranked = rows
    .map((r) => {
      const stats: UserStats = {
        totalSessions: Number(r.total_sessions),
        completedSessions: Number(r.completed_sessions),
        rdvCount: Number(r.rdv_count),
        rdvRate:
          r.completed_sessions > 0
            ? Math.round((Number(r.rdv_count) / Number(r.completed_sessions)) * 100)
            : 0,
        avgScore:
          r.completed_sessions > 0
            ? Math.round(Number(r.score_sum) / Number(r.completed_sessions))
            : null,
        bestScore: r.best_score ?? null,
        scoreSum: Number(r.score_sum),
        perfectScores: Number(r.perfect_scores),
        expertSessions: Number(r.expert_sessions),
        consecutiveRdvs: 0,
        distinctClients: Number(r.distinct_clients),
        distinctPersonas: Number(r.distinct_personas),
        daysActive: Number(r.days_active),
      };
      return {
        user_id: r.user_id,
        full_name: r.full_name ?? "Anonyme",
        avatar_url: r.avatar_url,
        role: r.role,
        stats,
        score: leaderboardScore(stats),
        badges: computeBadges(stats),
      };
    })
    .sort((a, b) => b.score - a.score);

  const myRow = ranked.find((r) => r.user_id === user.id);
  const myRank = myRow ? ranked.findIndex((r) => r.user_id === user.id) + 1 : null;
  const myBadges = myRow?.badges ?? [];
  const myUnlocked = myBadges.filter((b) => b.unlocked).length;

  return (
    <div className="relative">
      <div className="mission-blob mission-blob-purple" aria-hidden="true" />
      <div className="mission-blob mission-blob-green" aria-hidden="true" />

      <div className="container-noxias py-10 mission-content space-y-10">
        <header className="space-y-3">
          <span className="mission-classified">
            <span
              style={{
                display: "inline-block",
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--color-green)",
                animation: "login-dot-pulse 1.6s ease-out infinite",
              }}
              aria-hidden="true"
            />
            HALL OF FAME · NOXIAS
          </span>
          <h1 className="mission-h1">
            Le <span className="accent">classement</span>.
          </h1>
          <p className="mission-subtitle">
            Plus de RDV décrochés, plus de XP, plus haut au tableau. Le score
            cumulé valorise les performants ET les réguliers.
          </p>
        </header>

      {myRow && (
        <div className="mission-card mission-card-accent">
          <div className="flex items-center gap-5 flex-wrap">
            <Avatar src={myRow.avatar_url} name={myRow.full_name} size={64} ring />
            <div className="flex-1">
              <div
                className="mission-eyebrow"
                style={{ color: "rgba(255,255,255,0.65)" }}
              >
                Ta position
              </div>
              <div className="flex items-baseline gap-3 flex-wrap mt-1">
                <h2
                  className="mission-stat-num"
                  style={{ fontSize: "2.6rem", margin: 0 }}
                >
                  #{myRank}
                </h2>
                <span
                  className="mission-stat-num mission-stat-num-green"
                  style={{ fontSize: "1.8rem", margin: 0 }}
                >
                  {myRow.score} pts
                </span>
              </div>
              <p
                className="text-small mt-2"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                {myRow.stats.completedSessions} appel
                {myRow.stats.completedSessions > 1 ? "s" : ""} ·{" "}
                {myRow.stats.rdvCount} RDV · {myRow.stats.rdvRate}% de réussite ·{" "}
                {myUnlocked}/{myBadges.length} badges
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="space-y-4">
        <h2
          className="mission-h1"
          style={{ fontSize: "1.6rem" }}
        >
          Top équipe
        </h2>
        {ranked.length === 0 ? (
          <div className="mission-card text-center py-14">
            <p style={{ color: "rgba(255,255,255,0.6)" }}>
              Personne n&apos;a encore terminé un appel. Sois le premier.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {ranked.map((r, idx) => {
              const isMe = r.user_id === user.id;
              const rank = idx + 1;
              return (
                <div
                  key={r.user_id}
                  className={`mission-card ${rank <= 3 ? "mission-card-violet" : ""}`}
                >
                  <div className="flex items-center gap-4 flex-wrap">
                    <RankBadge rank={rank} />
                    <Avatar
                      src={r.avatar_url}
                      name={r.full_name}
                      size={48}
                      ring={rank <= 3}
                    />
                    <div className="flex-1 min-w-[180px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-h4"
                          style={{ color: "#FFFFFF" }}
                        >
                          {r.full_name}
                        </span>
                        {r.role === "manager" && (
                          <span
                            className="text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded"
                            style={{
                              background: "var(--color-purple)",
                              color: "#FFFFFF",
                              fontWeight: 700,
                            }}
                          >
                            Manager
                          </span>
                        )}
                        {isMe && (
                          <span
                            className="badge"
                            style={{
                              background: "rgba(60, 200, 121, 0.22)",
                              color: "var(--color-green)",
                            }}
                          >
                            Toi
                          </span>
                        )}
                      </div>
                      <p
                        className="text-small mt-1"
                        style={{ color: "rgba(255,255,255,0.6)" }}
                      >
                        {r.stats.completedSessions} appels ·{" "}
                        <span style={{ color: "var(--color-green)", fontWeight: 600 }}>
                          {r.stats.rdvCount} RDV
                        </span>{" "}
                        · {r.stats.rdvRate}% · note moy.{" "}
                        {r.stats.avgScore ?? "·"}/100
                      </p>
                    </div>
                    <div className="text-right">
                      <div
                        className="mission-stat-num"
                        style={{
                          fontSize: "2rem",
                          color: rank <= 3 ? "var(--color-green)" : "#FFFFFF",
                        }}
                      >
                        {r.score}
                      </div>
                      <div
                        className="mission-tile-label"
                        style={{ color: "rgba(255,255,255,0.5)" }}
                      >
                        points
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {myBadges.length > 0 && (
        <section className="space-y-4">
          <h2 className="mission-h1" style={{ fontSize: "1.6rem" }}>
            Tes badges
          </h2>
          <p
            className="text-small"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            {myUnlocked}/{myBadges.length} débloqués. Continue à enchaîner les
            appels pour décrocher les autres.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myBadges.map((b) => {
              const cfg = rarityColors(b.rarity);
              return (
              <div
                key={b.id}
                className={`mission-card ${b.unlocked ? "" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <Medal
                    icon={b.icon}
                    rarity={b.rarity}
                    size={72}
                    locked={!b.unlocked}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-h4"
                        style={{ color: "#FFFFFF" }}
                      >
                        {b.label}
                      </span>
                      <span
                        className="badge"
                        style={{
                          background: `${cfg.primary}33`,
                          color: cfg.primary,
                          fontWeight: 700,
                          border: `1px solid ${cfg.primary}55`,
                        }}
                      >
                        {rarityLabel(b.rarity)}
                      </span>
                      {b.unlocked && (
                        <span
                          className="badge"
                          style={{
                            background: "rgba(60, 200, 121, 0.22)",
                            color: "var(--color-green)",
                          }}
                        >
                          ✓ Débloqué
                        </span>
                      )}
                    </div>
                    <p
                      className="text-small mt-1"
                      style={{ color: "rgba(255,255,255,0.6)" }}
                    >
                      {b.description}
                    </p>
                    <div className="mt-2 flex items-center gap-3 flex-wrap">
                      <span
                        className="text-meta font-bold"
                        style={{ color: cfg.primary, letterSpacing: "0.05em" }}
                      >
                        +{b.xpReward} XP
                      </span>
                      {b.progress && !b.unlocked && (
                        <span
                          className="text-meta"
                          style={{ color: "rgba(255,255,255,0.55)" }}
                        >
                          {b.progress.current}/{b.progress.target}
                        </span>
                      )}
                    </div>
                    {b.progress && !b.unlocked && (
                      <div className="mt-2">
                        <div
                          className="h-1.5 rounded-full overflow-hidden"
                          style={{ background: "rgba(255,255,255,0.10)" }}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, (b.progress.current / b.progress.target) * 100)}%`,
                              background: cfg.primary,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </section>
      )}
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const styles =
    rank === 1
      ? { background: "linear-gradient(135deg, #F7C041, #E59A1B)", color: "#5C3A02" }
      : rank === 2
        ? { background: "linear-gradient(135deg, #D6D6E0, #A8A8B8)", color: "#3A3A4A" }
        : rank === 3
          ? { background: "linear-gradient(135deg, #C28859, #8E5A2B)", color: "#3A1F08" }
          : { background: "rgba(139, 127, 163, 0.16)", color: "var(--color-purple)" };
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold shrink-0"
      style={{
        width: 44,
        height: 44,
        fontSize: rank > 99 ? "0.9rem" : "1.1rem",
        ...styles,
      }}
    >
      #{rank}
    </div>
  );
}
