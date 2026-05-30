import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { TrainingModeBadge } from "@/components/TrainingModeBadge";
import { createClient } from "@/lib/supabase/server";
import { isManagerOrAbove } from "@/lib/auth-helpers";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { rankFromPpn, totalPpn } from "@/lib/ranks";
import { formatRelativeFr } from "@/lib/format";
import {
  diagnoseCommercial,
  type CommercialDiagnostic,
} from "@/lib/coach-diagnostic";
import type {
  MessageRow,
  SessionRow,
  TrainingMode,
  UserRole,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

// Tableau de bord manager. Réservé aux rôles manager / org_admin /
// platform_admin. Affiche :
// 1. Pulse équipe : 4 KPI semaine avec trend vs S-1 (sessions, RDV,
//    score moyen, taux RDV)
// 2. Répartition par mode (donut + nombres)
// 3. Tableau commerciaux : nom, rang, dernière activité, sessions
//    semaine, RDV, score moyen + trend, axe à travailler (diag IA)
// 4. Alertes : inactifs > 7j, chute score, sans RDV sur 10+ sessions
export default async function ManagerDashboardPage() {
  const supabase = await createClient();
  if (!isSupabaseConfigured()) {
    return (
      <div className="container-noxias py-10 max-w-3xl">
        <h1 className="text-h2">Manager · Tableau de bord</h1>
        <p className="text-body mt-3" style={{ color: "var(--color-gray)" }}>
          Configuration Supabase manquante.
        </p>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();
  const role = (profile as { role?: UserRole } | null)?.role ?? null;
  const orgId = (profile as { organization_id?: string } | null)
    ?.organization_id;
  if (!isManagerOrAbove(role)) redirect("/dashboard");

  // ---------- Fetch toutes les sessions de l'org sur 30 derniers jours
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: sessionsData } = await supabase
    .from("sessions")
    .select("*")
    .eq("organization_id", orgId ?? "")
    .gte("started_at", since30)
    .order("started_at", { ascending: false });
  const allSessions = (sessionsData ?? []) as SessionRow[];

  // Profils des commerciaux de l'org (pour les avatars et noms)
  const { data: usersData } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("organization_id", orgId ?? "");
  const usersById = new Map<
    string,
    { full_name: string; avatar_url: string | null }
  >();
  for (const u of (usersData ?? []) as {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  }[]) {
    usersById.set(u.id, {
      full_name: u.full_name ?? "Anonyme",
      avatar_url: u.avatar_url,
    });
  }

  // ---------- Fetch metadata des messages prospect des 30 derniers jours
  // (uniquement les sessions complétées) pour le diagnostic delta_category.
  const completedSessionIds = allSessions
    .filter((s) => s.status === "completed")
    .map((s) => s.id);
  const { data: messagesData } =
    completedSessionIds.length > 0
      ? await supabase
          .from("messages")
          .select("session_id, metadata")
          .eq("role", "prospect")
          .in("session_id", completedSessionIds)
      : { data: [] };
  const messagesBySession = new Map<string, Pick<MessageRow, "metadata">[]>();
  for (const m of (messagesData ?? []) as {
    session_id: string;
    metadata: Record<string, unknown> | null;
  }[]) {
    const arr = messagesBySession.get(m.session_id) ?? [];
    arr.push({ metadata: m.metadata });
    messagesBySession.set(m.session_id, arr);
  }

  // ---------- KPI semaine vs S-1
  const now = Date.now();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const thisWeek = allSessions.filter(
    (s) => now - new Date(s.started_at).getTime() < oneWeek,
  );
  const prevWeek = allSessions.filter((s) => {
    const t = new Date(s.started_at).getTime();
    return now - t >= oneWeek && now - t < 2 * oneWeek;
  });
  const kpiThis = computeKpi(thisWeek);
  const kpiPrev = computeKpi(prevWeek);

  // ---------- Répartition par mode (30 jours)
  const modeBreakdown: Record<TrainingMode, number> = {
    full: 0,
    block: 0,
    embedded: 0,
  };
  for (const s of allSessions.filter((s) => s.status === "completed")) {
    modeBreakdown[s.training_mode] = (modeBreakdown[s.training_mode] ?? 0) + 1;
  }
  const modeTotal =
    modeBreakdown.full + modeBreakdown.block + modeBreakdown.embedded;

  // ---------- Stats par commercial
  type CommercialStat = {
    userId: string;
    fullName: string;
    avatarUrl: string | null;
    sessionsThisWeek: number;
    rdvCount: number;
    avgScore: number | null;
    avgScoreTrend: "up" | "down" | "flat" | null;
    rank: ReturnType<typeof rankFromPpn>;
    lastSession: SessionRow | null;
    diagnostic: CommercialDiagnostic;
  };
  const byUser = new Map<string, SessionRow[]>();
  for (const s of allSessions) {
    const arr = byUser.get(s.user_id) ?? [];
    arr.push(s);
    byUser.set(s.user_id, arr);
  }
  const commercials: CommercialStat[] = [];
  for (const [userId, sessions] of byUser.entries()) {
    const profile = usersById.get(userId) ?? {
      full_name: "Anonyme",
      avatar_url: null,
    };
    const completed = sessions.filter((s) => s.status === "completed");
    const thisWeekCompleted = completed.filter(
      (s) => now - new Date(s.started_at).getTime() < oneWeek,
    );
    const prevWeekCompleted = completed.filter((s) => {
      const t = new Date(s.started_at).getTime();
      return now - t >= oneWeek && now - t < 2 * oneWeek;
    });
    const scoresThis = thisWeekCompleted
      .map((s) => s.score)
      .filter((n): n is number => typeof n === "number");
    const scoresPrev = prevWeekCompleted
      .map((s) => s.score)
      .filter((n): n is number => typeof n === "number");
    const avgScore =
      scoresThis.length > 0
        ? Math.round(scoresThis.reduce((a, b) => a + b, 0) / scoresThis.length)
        : null;
    const avgScorePrev =
      scoresPrev.length > 0
        ? Math.round(scoresPrev.reduce((a, b) => a + b, 0) / scoresPrev.length)
        : null;
    const avgScoreTrend: "up" | "down" | "flat" | null =
      avgScore === null || avgScorePrev === null
        ? null
        : avgScore > avgScorePrev + 3
          ? "up"
          : avgScore < avgScorePrev - 3
            ? "down"
            : "flat";

    // Diagnostic à partir des delta_category sur les sessions complétées
    // de ce commercial.
    const userMessages: Pick<MessageRow, "metadata">[] = [];
    for (const s of completed) {
      const msgs = messagesBySession.get(s.id);
      if (msgs) userMessages.push(...msgs);
    }
    const diagnostic = diagnoseCommercial(completed, userMessages);

    commercials.push({
      userId,
      fullName: profile.full_name,
      avatarUrl: profile.avatar_url,
      sessionsThisWeek: thisWeekCompleted.length,
      rdvCount: completed.filter((s) => s.appointment_secured).length,
      avgScore,
      avgScoreTrend,
      rank: rankFromPpn(totalPpn(sessions)),
      lastSession: completed[0] ?? null,
      diagnostic,
    });
  }
  commercials.sort((a, b) => b.sessionsThisWeek - a.sessionsThisWeek);

  // ---------- Alertes
  const alerts: {
    type: "inactive" | "score_drop" | "no_rdv";
    userId: string;
    fullName: string;
    detail: string;
  }[] = [];
  for (const c of commercials) {
    if (
      c.lastSession &&
      now - new Date(c.lastSession.started_at).getTime() > 7 * oneWeek / 7
    ) {
      const daysAgo = Math.floor(
        (now - new Date(c.lastSession.started_at).getTime()) /
          (24 * 60 * 60 * 1000),
      );
      if (daysAgo > 7) {
        alerts.push({
          type: "inactive",
          userId: c.userId,
          fullName: c.fullName,
          detail: `Inactif depuis ${daysAgo} jours`,
        });
      }
    }
    if (c.avgScoreTrend === "down" && c.avgScore !== null) {
      alerts.push({
        type: "score_drop",
        userId: c.userId,
        fullName: c.fullName,
        detail: `Score en baisse cette semaine (${c.avgScore}/100)`,
      });
    }
    const totalCompleted = (byUser.get(c.userId) ?? []).filter(
      (s) => s.status === "completed",
    ).length;
    if (totalCompleted >= 10 && c.rdvCount === 0) {
      alerts.push({
        type: "no_rdv",
        userId: c.userId,
        fullName: c.fullName,
        detail: `Aucun RDV sur ${totalCompleted} sessions`,
      });
    }
  }

  return (
    <div className="container-noxias py-10 max-w-6xl space-y-8">
      <header className="space-y-2">
        <div className="eyebrow-green">Tableau de bord manager</div>
        <h1
          className="text-h1"
          style={{
            fontSize: "clamp(1.8rem, 3.5vw, 2.6rem)",
            lineHeight: "1.05",
          }}
        >
          La performance de ton équipe.
        </h1>
        <p
          className="text-body-l"
          style={{ color: "rgba(255,255,255,0.7)", maxWidth: "60ch" }}
        >
          {commercials.length} commerciaux dans ton équipe, {allSessions.length}{" "}
          sessions sur 30 jours. Le diagnostic ci-dessous te dit où chaque
          commercial doit concentrer son effort.
        </p>
      </header>

      {/* 1. KPI équipe semaine vs S-1 */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Sessions"
          value={kpiThis.sessions}
          prev={kpiPrev.sessions}
          suffix=""
        />
        <KpiCard
          label="RDV"
          value={kpiThis.rdv}
          prev={kpiPrev.rdv}
          suffix=""
        />
        <KpiCard
          label="Taux RDV"
          value={kpiThis.rdvRate}
          prev={kpiPrev.rdvRate}
          suffix="%"
        />
        <KpiCard
          label="Score moyen"
          value={kpiThis.avgScore}
          prev={kpiPrev.avgScore}
          suffix="/100"
        />
      </section>

      {/* 2. Répartition par mode + 3. Alertes (côte à côte) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-h4 mb-3">Répartition par mode (30 j)</h3>
          {modeTotal === 0 ? (
            <p className="text-small" style={{ color: "rgba(255,255,255,0.55)" }}>
              Aucune session complétée sur les 30 derniers jours.
            </p>
          ) : (
            <ModeBreakdownChart breakdown={modeBreakdown} total={modeTotal} />
          )}
        </Card>

        {alerts.length > 0 ? (
          <Card>
            <h3 className="text-h4 mb-3">Alertes</h3>
            <ul className="space-y-2">
              {alerts.slice(0, 5).map((a, i) => (
                <li key={i} className="manager-alert">
                  <span
                    className={`manager-alert-dot manager-alert-dot-${a.type}`}
                    aria-hidden="true"
                  />
                  <Link
                    href={`/history/${a.userId}`}
                    className="manager-alert-text"
                  >
                    <span className="manager-alert-name">{a.fullName}</span>
                    <span className="manager-alert-detail">{a.detail}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card>
            <h3 className="text-h4 mb-3">Alertes</h3>
            <p className="text-small" style={{ color: "rgba(255,255,255,0.55)" }}>
              Aucune alerte. Tout le monde est actif et performe.
            </p>
          </Card>
        )}
      </section>

      {/* 4. Tableau commerciaux avec diagnostic individuel */}
      <section className="space-y-3">
        <div>
          <h2 className="text-h3">Diagnostic par commercial</h2>
          <p
            className="text-small mt-1"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            Top défauts détectés sur les sessions récentes + recommandation
            d&apos;entraînement ciblé pour que chacun se concentre sur SON
            point faible.
          </p>
        </div>
        <div className="space-y-3">
          {commercials.map((c) => (
            <CommercialDiagnosticCard key={c.userId} stat={c} />
          ))}
          {commercials.length === 0 && (
            <Card>
              <p
                className="text-small"
                style={{ color: "rgba(255,255,255,0.55)" }}
              >
                Aucun commercial dans ton équipe pour l&apos;instant.
              </p>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}

// ----- Helpers de calcul

function computeKpi(sessions: SessionRow[]): {
  sessions: number;
  rdv: number;
  rdvRate: number;
  avgScore: number;
} {
  const completed = sessions.filter((s) => s.status === "completed");
  const rdv = completed.filter((s) => s.appointment_secured).length;
  const scores = completed
    .map((s) => s.score)
    .filter((n): n is number => typeof n === "number");
  return {
    sessions: completed.length,
    rdv,
    rdvRate: completed.length > 0 ? Math.round((rdv / completed.length) * 100) : 0,
    avgScore:
      scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0,
  };
}

// ----- Composants

function KpiCard({
  label,
  value,
  prev,
  suffix,
}: {
  label: string;
  value: number;
  prev: number;
  suffix: string;
}) {
  const delta = value - prev;
  const trend = delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  return (
    <Card>
      <div className="manager-kpi">
        <div className="manager-kpi-label">{label}</div>
        <div className="manager-kpi-value">
          {value}
          <span className="manager-kpi-suffix">{suffix}</span>
        </div>
        <div className={`manager-kpi-trend manager-kpi-trend-${trend}`}>
          {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}{" "}
          {delta > 0 ? `+${delta}` : delta}
          {suffix} vs S-1
        </div>
      </div>
    </Card>
  );
}

function ModeBreakdownChart({
  breakdown,
  total,
}: {
  breakdown: Record<TrainingMode, number>;
  total: number;
}) {
  const modes: { key: TrainingMode; label: string; color: string }[] = [
    { key: "block", label: "Coaching ciblé", color: "var(--color-green)" },
    { key: "embedded", label: "Coaching embarqué", color: "var(--color-warning)" },
    { key: "full", label: "Appel complet", color: "#b495ff" },
  ];
  return (
    <div className="space-y-3">
      {/* Barre empilée */}
      <div className="manager-mode-bar">
        {modes.map((m) => {
          const pct = total > 0 ? (breakdown[m.key] / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={m.key}
              className="manager-mode-bar-seg"
              style={{ width: `${pct}%`, background: m.color }}
              title={`${m.label} : ${breakdown[m.key]} sessions`}
            />
          );
        })}
      </div>
      {/* Légende */}
      <ul className="manager-mode-legend">
        {modes.map((m) => {
          const pct = total > 0 ? Math.round((breakdown[m.key] / total) * 100) : 0;
          return (
            <li key={m.key} className="manager-mode-legend-item">
              <span
                className="manager-mode-legend-dot"
                style={{ background: m.color }}
                aria-hidden="true"
              />
              <span className="manager-mode-legend-label">{m.label}</span>
              <span className="manager-mode-legend-count">
                {breakdown[m.key]} ({pct}%)
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CommercialDiagnosticCard({
  stat,
}: {
  stat: {
    userId: string;
    fullName: string;
    avatarUrl: string | null;
    sessionsThisWeek: number;
    rdvCount: number;
    avgScore: number | null;
    avgScoreTrend: "up" | "down" | "flat" | null;
    rank: ReturnType<typeof rankFromPpn>;
    lastSession: SessionRow | null;
    diagnostic: CommercialDiagnostic;
  };
}) {
  return (
    <Card>
      <div className="manager-commercial-row">
        {/* Identité + rang */}
        <div className="manager-commercial-identity">
          <Avatar src={stat.avatarUrl} name={stat.fullName} size={44} />
          <div>
            <Link
              href={`/history/${stat.userId}`}
              className="manager-commercial-name"
            >
              {stat.fullName}
            </Link>
            <div className="manager-commercial-meta">
              {stat.rank.tierLabel}
              {stat.lastSession && (
                <>
                  {" · "}
                  Vu {formatRelativeFr(stat.lastSession.started_at)}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats semaine */}
        <div className="manager-commercial-stats">
          <Stat label="Sessions sem." value={stat.sessionsThisWeek} />
          <Stat label="RDV" value={stat.rdvCount} />
          <Stat
            label="Score moy."
            value={stat.avgScore ?? "—"}
            trend={stat.avgScoreTrend}
          />
        </div>
      </div>

      {/* Diagnostic IA */}
      {stat.diagnostic.hasEnoughData ? (
        <div className="manager-diagnostic">
          {stat.diagnostic.topDefects.length > 0 ? (
            <>
              <div className="manager-diagnostic-defects">
                <span className="manager-diagnostic-eyebrow">
                  Top défauts
                </span>
                <div className="manager-diagnostic-defects-list">
                  {stat.diagnostic.topDefects.map((d) => (
                    <span key={d.category} className="manager-defect-chip">
                      {d.label}
                      <span className="manager-defect-chip-count">
                        ×{d.count}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
              {stat.diagnostic.recommendation && (
                <div className="manager-recommendation">
                  <div className="manager-recommendation-headline">
                    <span aria-hidden="true">→</span>{" "}
                    {stat.diagnostic.recommendation.headline}
                  </div>
                  <p className="manager-recommendation-reason">
                    {stat.diagnostic.recommendation.reason}
                  </p>
                </div>
              )}
            </>
          ) : (
            stat.diagnostic.recommendation && (
              <div className="manager-recommendation manager-recommendation-positive">
                <div className="manager-recommendation-headline">
                  <span aria-hidden="true">✓</span>{" "}
                  {stat.diagnostic.recommendation.headline}
                </div>
                <p className="manager-recommendation-reason">
                  {stat.diagnostic.recommendation.reason}
                </p>
              </div>
            )
          )}
        </div>
      ) : (
        <p className="manager-diagnostic-empty">
          Pas assez de données pour un diagnostic fiable (3 sessions minimum).
        </p>
      )}

      {/* Mini-vignette de la dernière session avec son mode */}
      {stat.lastSession && (
        <div className="manager-last-session">
          <span className="manager-last-session-label">Dernière session :</span>
          <TrainingModeBadge
            mode={stat.lastSession.training_mode}
            blockTarget={stat.lastSession.block_target}
            embeddedBlocksCount={stat.lastSession.embedded_blocks_count}
            compact
          />
          <span className="manager-last-session-meta">
            {stat.lastSession.persona_label}
            {stat.lastSession.appointment_secured && " · ✓ RDV"}
          </span>
        </div>
      )}
    </Card>
  );
}

function Stat({
  label,
  value,
  trend,
}: {
  label: string;
  value: number | string;
  trend?: "up" | "down" | "flat" | null;
}) {
  return (
    <div className="manager-stat">
      <div className="manager-stat-value">
        {value}
        {trend && (
          <span className={`manager-stat-trend manager-stat-trend-${trend}`}>
            {trend === "up" ? "↑" : trend === "down" ? "↓" : ""}
          </span>
        )}
      </div>
      <div className="manager-stat-label">{label}</div>
    </div>
  );
}
