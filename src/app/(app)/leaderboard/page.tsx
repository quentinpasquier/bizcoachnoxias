import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { PageHeader } from "@/components/PageHeader";
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
        <PageHeader title="Classement" />
        <Card variant="lavender" className="text-center py-14">
          <p style={{ color: "var(--color-error)" }}>
            Impossible de charger le classement : {error.message}
          </p>
        </Card>
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
    <div className="container-noxias py-12 space-y-10">
      <PageHeader
        title="Classement"
        subtitle="Les meilleurs prospecteurs Noxias. Plus de RDV, plus de points."
      />

      {myRow && (
        <Card variant="dark">
          <div className="flex items-center gap-5 flex-wrap">
            <Avatar src={myRow.avatar_url} name={myRow.full_name} size={64} ring />
            <div className="flex-1">
              <div
                className="eyebrow mb-1"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Toi
              </div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <h2
                  className="text-h2"
                  style={{ color: "#FFFFFF", margin: 0 }}
                >
                  #{myRank}
                </h2>
                <span
                  className="text-h3"
                  style={{ color: "var(--color-green)", margin: 0 }}
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
        </Card>
      )}

      <section className="space-y-4">
        <h2 className="text-h3">Top équipe</h2>
        {ranked.length === 0 ? (
          <Card variant="lavender" className="text-center py-14">
            <p style={{ color: "var(--color-gray)" }}>
              Personne n&apos;a encore terminé un appel. Sois le premier.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {ranked.map((r, idx) => {
              const isMe = r.user_id === user.id;
              const rank = idx + 1;
              return (
                <Card key={r.user_id} hoverable={false}>
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
                          style={{ color: "var(--color-dark)" }}
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
                              background: "rgba(60, 200, 121, 0.16)",
                              color: "#1F6A3F",
                            }}
                          >
                            Toi
                          </span>
                        )}
                      </div>
                      <p
                        className="text-small mt-1"
                        style={{ color: "var(--color-gray)" }}
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
                        style={{
                          fontSize: "2rem",
                          lineHeight: "1",
                          color: "var(--color-purple)",
                          fontWeight: 600,
                        }}
                      >
                        {r.score}
                      </div>
                      <div
                        className="text-meta uppercase tracking-widest"
                        style={{ color: "var(--color-gray)" }}
                      >
                        points
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {myBadges.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-h3">Tes badges</h2>
          <p
            className="text-small"
            style={{ color: "var(--color-gray)" }}
          >
            {myUnlocked}/{myBadges.length} débloqués. Continue à enchaîner les
            appels pour décrocher les autres.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {myBadges.map((b) => (
              <Card
                key={b.id}
                variant={b.unlocked ? "default" : "lavender"}
                hoverable={false}
              >
                <div
                  className="flex items-start gap-3"
                  style={{ opacity: b.unlocked ? 1 : 0.55 }}
                >
                  <div
                    className="text-3xl shrink-0"
                    style={{
                      filter: b.unlocked ? "none" : "grayscale(1)",
                    }}
                    aria-hidden="true"
                  >
                    {b.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-h4"
                        style={{ color: "var(--color-dark)" }}
                      >
                        {b.label}
                      </span>
                      {b.unlocked && (
                        <span
                          className="badge"
                          style={{
                            background: "rgba(60, 200, 121, 0.18)",
                            color: "#1F6A3F",
                          }}
                        >
                          Débloqué
                        </span>
                      )}
                    </div>
                    <p
                      className="text-small mt-1"
                      style={{ color: "var(--color-gray)" }}
                    >
                      {b.description}
                    </p>
                    {b.progress && !b.unlocked && (
                      <div className="mt-2">
                        <div
                          className="h-1.5 rounded-full overflow-hidden"
                          style={{ background: "rgba(139, 127, 163, 0.18)" }}
                        >
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, (b.progress.current / b.progress.target) * 100)}%`,
                              background: "var(--color-purple)",
                            }}
                          />
                        </div>
                        <span
                          className="text-meta mt-1 block"
                          style={{ color: "var(--color-gray)" }}
                        >
                          {b.progress.current}/{b.progress.target}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
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
