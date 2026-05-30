import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isManagerOrAbove } from "@/lib/auth-helpers";
import { HistoryBoard } from "../HistoryBoard";
import { CommercialScanPanel } from "@/app/(app)/manager/CommercialScanPanel";
import { diagnoseCommercial } from "@/lib/coach-diagnostic";
import { computeStats } from "@/lib/badges";
import { rankFromPpn, totalPpn } from "@/lib/ranks";
import type {
  Client,
  MessageRow,
  SessionRow,
  UserRole,
} from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function PlayerHistoryPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const supabase = await createClient();
  if (!isSupabaseConfigured()) redirect("/dashboard");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Vérifie que l'utilisateur courant est manager (sinon redirige vers son
  // propre historique)
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const myRole = ((myProfile as { role?: UserRole } | null)?.role ??
    "commercial") as UserRole;
  // Accès autorisé pour : le user lui-même OU n'importe quel rôle manager
  // (manager, org_admin, platform_admin). Sinon redirige vers son propre
  // historique.
  if (!isManagerOrAbove(myRole) && user.id !== userId) {
    redirect("/history");
  }
  const viewerIsManager = isManagerOrAbove(myRole);

  const [
    { data: targetProfile },
    { data: sessionsData },
    { data: clientsData },
    { data: profilesData },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, role")
      .eq("id", userId)
      .single(),
    supabase
      .from("sessions")
      .select("*")
      .eq("user_id", userId)
      .order("started_at", { ascending: false }),
    supabase.from("clients").select("id, name, sector"),
    supabase.from("profiles").select("id, full_name, avatar_url"),
  ]);

  if (!targetProfile) notFound();

  const profile = targetProfile as {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    role: UserRole;
  };
  const sessions = (sessionsData ?? []) as SessionRow[];
  const clients = (clientsData ?? []) as Pick<Client, "id" | "name" | "sector">[];
  const clientByIdObj = Object.fromEntries(
    clients.map((c) => [c.id, { name: c.name, sector: c.sector }]),
  );
  const profileById = Object.fromEntries(
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

  const stats = computeStats(sessions);
  const ppn = totalPpn(sessions);
  const rank = rankFromPpn(ppn);
  const completedSessions = sessions.filter((s) => s.status === "completed");

  // Diagnostic rapide (déterministe) basé sur les delta_category stockés
  // dans les messages des sessions complétées. Donne au manager une vue
  // immédiate AVANT même de lancer le scan IA.
  let diagnostic: ReturnType<typeof diagnoseCommercial> | null = null;
  if (viewerIsManager && completedSessions.length >= 3) {
    const completedIds = completedSessions.map((s) => s.id);
    const { data: msgData } = await supabase
      .from("messages")
      .select("metadata")
      .in("session_id", completedIds)
      .eq("role", "prospect");
    diagnostic = diagnoseCommercial(
      completedSessions,
      (msgData ?? []) as Pick<MessageRow, "metadata">[],
    );
  }

  return (
    <div className="container-noxias py-10 max-w-5xl space-y-8">
      <Link
        href={viewerIsManager ? "/manager" : "/history"}
        className="text-small inline-flex items-center gap-1.5"
        style={{ color: "rgba(255, 255, 255, 0.65)" }}
      >
        ← {viewerIsManager ? "Retour au tableau de bord équipe" : "Retour à l’historique"}
      </Link>

      <header className="flex items-center gap-5 flex-wrap">
        <Avatar src={profile.avatar_url} name={profile.full_name} size={80} ring />
        <div className="flex-1 min-w-0">
          <div className="eyebrow-green">Détail joueur</div>
          <h1
            className="text-h1 mt-2"
            style={{
              color: "#FFFFFF",
              fontSize: "clamp(2rem, 4vw, 2.8rem)",
              lineHeight: "1.05",
            }}
          >
            {profile.full_name ?? "Anonyme"}
          </h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span
              style={{
                color: rank.primary,
                fontWeight: 700,
                fontSize: "0.95rem",
              }}
            >
              {rank.label}
            </span>
            <span style={{ color: "rgba(255,255,255,0.4)" }}>·</span>
            <span style={{ color: "rgba(255,255,255,0.65)" }}>
              {ppn.toLocaleString("fr-FR")} PPN cumulés
            </span>
            {(profile.role === "manager" ||
              profile.role === "org_admin" ||
              profile.role === "platform_admin") && (
              <span
                style={{
                  background:
                    profile.role === "platform_admin"
                      ? "var(--color-warning, #F4B400)"
                      : "var(--color-green)",
                  color: "var(--color-dark)",
                  fontSize: "0.62rem",
                  letterSpacing: "0.18em",
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                {profile.role === "platform_admin"
                  ? "Admin Noxias"
                  : profile.role === "org_admin"
                    ? "Admin"
                    : "Manager"}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Stats résumé */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Appels bouclés" value={stats.completedSessions.toString()} accent="#3CC879" />
        <SummaryCard label="RDV décrochés" value={stats.rdvCount.toString()} accent="#F7C041" />
        <SummaryCard
          label="Score moyen"
          value={stats.avgScore !== null ? `${stats.avgScore}/100` : "·"}
          accent="#9d6bff"
        />
        <SummaryCard
          label="Taux de transformation"
          value={`${stats.rdvRate}%`}
          accent="#4A8FE7"
        />
      </section>

      {/* Section manager : diagnostic rapide + scan IA. Cachée si on
          regarde sa propre fiche (ce sont des outils de coaching). */}
      {viewerIsManager && (
        <>
          {diagnostic && diagnostic.hasEnoughData && (
            <section className="space-y-3">
              <div>
                <h2 className="text-h3" style={{ color: "#FFFFFF" }}>
                  Diagnostic rapide
                </h2>
                <p
                  className="text-small mt-1"
                  style={{ color: "rgba(255,255,255,0.6)" }}
                >
                  Patterns détectés sur les {completedSessions.length}{" "}
                  sessions complétées. Calcul instantané basé sur les signaux
                  de l&apos;appel. Pour une analyse approfondie avec
                  citations, lance le scan IA ci-dessous.
                </p>
              </div>
              <Card>
                {diagnostic.topDefects.length > 0 ? (
                  <div className="space-y-3">
                    <div>
                      <div className="manager-diagnostic-eyebrow">
                        Top défauts
                      </div>
                      <div className="manager-diagnostic-defects-list">
                        {diagnostic.topDefects.map((d) => (
                          <span
                            key={d.category}
                            className="manager-defect-chip"
                          >
                            {d.label}
                            <span className="manager-defect-chip-count">
                              ×{d.count}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                    {diagnostic.recommendation && (
                      <div className="manager-recommendation">
                        <div className="manager-recommendation-headline">
                          <span aria-hidden="true">→</span>{" "}
                          {diagnostic.recommendation.headline}
                        </div>
                        <p className="manager-recommendation-reason">
                          {diagnostic.recommendation.reason}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  diagnostic.recommendation && (
                    <div className="manager-recommendation manager-recommendation-positive">
                      <div className="manager-recommendation-headline">
                        <span aria-hidden="true">✓</span>{" "}
                        {diagnostic.recommendation.headline}
                      </div>
                      <p className="manager-recommendation-reason">
                        {diagnostic.recommendation.reason}
                      </p>
                    </div>
                  )
                )}
              </Card>
            </section>
          )}

          <section className="space-y-3">
            <div>
              <h2 className="text-h3" style={{ color: "#FFFFFF" }}>
                Scan IA approfondi
              </h2>
              <p
                className="text-small mt-1"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                Lance une analyse Claude des 5 dernières sessions complètes
                pour obtenir : défauts récurrents avec citations exactes,
                axes de travail prioritaires, plan recommandé. Résultat mis
                en cache 24h.
              </p>
            </div>
            <Card>
              <CommercialScanPanel
                userId={userId}
                fullName={profile.full_name ?? "Anonyme"}
                totalCompletedSessions={completedSessions.length}
              />
            </Card>
          </section>
        </>
      )}

      <section>
        <h2 className="text-h3" style={{ color: "#FFFFFF" }}>
          Toutes ses sessions
        </h2>
        {sessions.length === 0 ? (
          <Card variant="lavender" className="text-center py-10 mt-4">
            <p style={{ color: "rgba(255, 255, 255, 0.65)" }}>
              Aucune session pour ce joueur.
            </p>
          </Card>
        ) : (
          <div className="mt-4">
            <HistoryBoard
              sessions={sessions}
              clientById={clientByIdObj}
              profileById={profileById}
              myUserId={user.id}
              isManager
            />
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
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
        }}
      >
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
