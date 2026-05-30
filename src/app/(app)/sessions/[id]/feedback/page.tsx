import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge, DifficultyBadge } from "@/components/ui/Badge";
import { CoachTip } from "@/components/CoachTip";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeFr, formatDuration } from "@/lib/format";
import type {
  CategoryKey,
  Evaluation,
  MessageRow,
  QuoteRewrite,
  SessionRow,
} from "@/lib/supabase/types";
import { FeedbackEvaluator } from "./FeedbackEvaluator";
import { Celebration } from "./Celebration";
import { computeBadges, computeStats } from "@/lib/badges";
import { xpForSession } from "@/lib/xp";

export default async function FeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ celebrate?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const showCelebrate = sp.celebrate === "1";
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .single();

  if (!session) notFound();
  const s = session as SessionRow;
  if (s.status === "active") redirect(`/sessions/${id}`);

  const [{ data: messages }, { data: profileData }, { data: allSessionsData }] =
    await Promise.all([
      supabase
        .from("messages")
        .select("*")
        .eq("session_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", s.user_id)
        .single(),
      showCelebrate
        ? supabase
            .from("sessions")
            .select("*")
            .eq("user_id", s.user_id)
            .order("started_at", { ascending: false })
        : Promise.resolve({ data: null }),
    ]);

  if (!s.evaluation) {
    return <FeedbackEvaluator sessionId={id} />;
  }

  const evaluation = s.evaluation as Evaluation;
  const messagesList = (messages ?? []) as MessageRow[];
  const isLegacyFormat = !Array.isArray(evaluation.categories);
  const author = (profileData as { full_name?: string | null } | null)?.full_name ?? "Anonyme";

  const personaName = (s.scenario_data as { persona_name?: string } | null)?.persona_name ?? "";

  // Calcul des badges nouvellement débloqués (diff avant/après cette session)
  let newBadges: ReturnType<typeof computeBadges> = [];
  let xpEarned = 0;
  if (showCelebrate && allSessionsData) {
    const allSessions = allSessionsData as SessionRow[];
    const sessionsWith = allSessions;
    const sessionsWithout = allSessions.filter((x) => x.id !== id);
    const badgesAfter = computeBadges(computeStats(sessionsWith));
    const badgesBefore = computeBadges(computeStats(sessionsWithout));
    const beforeSet = new Set(
      badgesBefore.filter((b) => b.unlocked).map((b) => b.id),
    );
    newBadges = badgesAfter.filter(
      (b) => b.unlocked && !beforeSet.has(b.id),
    );
    xpEarned = xpForSession(s);
  }

  return (
    <div className="container-noxias py-12 space-y-12 max-w-4xl">
      {showCelebrate && (
        <Celebration
          score={evaluation.overall_score}
          appointmentSecured={s.appointment_secured}
          xpEarned={xpEarned}
          newBadges={newBadges}
        />
      )}
      {/* HERO */}
      <header>
        <Link
          href="/history"
          className="text-small hover:underline inline-flex items-center gap-1 mb-6"
          style={{ color: "rgba(255, 255, 255, 0.65)" }}
        >
          ← Retour à l&apos;historique
        </Link>
        <div className="eyebrow-green mb-2">Le débrief de ton appel</div>
        <h1 className="text-h2">Voilà ce que j&apos;ai vu.</h1>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {s.client_name_snapshot && (
            <Badge tone="purple">{s.client_name_snapshot}</Badge>
          )}
          <span className="text-body" style={{ color: "#FFFFFF" }}>
            {s.persona_label}
            {personaName && (
              <span style={{ color: "rgba(255, 255, 255, 0.65)" }}> · {personaName}</span>
            )}
          </span>
          <DifficultyBadge difficulty={s.difficulty} />
        </div>
        <div className="mt-2 flex items-center gap-3 flex-wrap text-small" style={{ color: "rgba(255, 255, 255, 0.65)" }}>
          <span style={{ color: "#FFFFFF", fontWeight: 500 }}>{author}</span>
          <span>·</span>
          <span>{formatDateTimeFr(s.started_at)}</span>
          <span>·</span>
          <span>Durée : {formatDuration(s.started_at, s.ended_at)}</span>
        </div>
      </header>

      {/* SCORE PRINCIPAL */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card variant="dark" className="md:col-span-1 flex flex-col items-center justify-center text-center py-12">
          <div
            className="section-eyebrow mb-3"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Ta note
          </div>
          <div
            className=""
            style={{
              fontSize: "6.5rem",
              lineHeight: "1",
              color:
                evaluation.overall_score >= 75
                  ? "var(--color-green)"
                  : evaluation.overall_score >= 50
                    ? "#FFFFFF"
                    : "var(--color-red)",
            }}
          >
            {evaluation.overall_score}
          </div>
          <div
            className="text-body mt-2"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            sur 100
          </div>
          {!isLegacyFormat && (
            <div
              className="text-meta mt-4 px-3 py-1 rounded-pill"
              style={{
                color: "rgba(255,255,255,0.7)",
                background: "rgba(255,255,255,0.06)",
              }}
            >
              {evaluation.criteria_total ?? 0} / {evaluation.criteria_max ?? 20}{" "}
              critères validés
            </div>
          )}
        </Card>

        <Card className="md:col-span-2 flex flex-col justify-center">
          <div className="mb-4">
            {s.appointment_secured ? (
              <Badge tone="success">RDV obtenu</Badge>
            ) : s.ended_by === "prospect" ? (
              <Badge tone="error">Prospect a raccroché</Badge>
            ) : (
              <Badge tone="neutral">Appel terminé</Badge>
            )}
          </div>
          <OutcomeSummary text={evaluation.outcome_summary} />
        </Card>
      </section>

      {/* LEVIERS D'AMÉLIORATION (priorité maximale) */}
      {Array.isArray(evaluation.quote_rewrites) &&
        evaluation.quote_rewrites.length > 0 && (
          <section className="space-y-5">
            <div>
              <div className="eyebrow-green mb-2">
                Tes leviers d&apos;amélioration
              </div>
              <h2 className="text-h2" style={{ fontSize: "1.8rem" }}>
                À retravailler concrètement.
              </h2>
              <p
                className="text-small mt-2"
                style={{ color: "rgba(255, 255, 255, 0.6)" }}
              >
                Chaque carte cite ce que tu as dit pendant l&apos;appel et
                propose une formulation prête à utiliser la prochaine fois.
              </p>
            </div>
            <CoachTip accent="green">
              Lis les leviers{" "}
              <strong style={{ color: "#FFFFFF" }}>avant</strong> le score. Le
              chiffre c&apos;est de la dopamine, ce qui te fait progresser ce
              sont les <strong>reformulations concrètes</strong> ci-dessous. La
              règle qui marche, observée sur mes équipes Noxias :{" "}
              <strong style={{ color: "#FFFFFF" }}>
                refais 1 session demain en intégrant 2 reformulations MAX
              </strong>
              . Le cerveau retient quand tu charges UN nouveau réflexe à la
              fois. En charger 5 d&apos;un coup = tu n&apos;en intègres aucun.
              Patience : c&apos;est sur 20-30 sessions qu&apos;un pattern
              s&apos;installe.
            </CoachTip>
            <div className="space-y-4">
              {evaluation.quote_rewrites.map((q, idx) => (
                <QuoteRewriteCard key={idx} rewrite={q} />
              ))}
            </div>
          </section>
        )}

      {/* CATÉGORIES, format 20 critères */}
      {!isLegacyFormat && Array.isArray(evaluation.categories) && (
        <section className="space-y-5">
          <h2 className="text-h3">Détail par catégorie</h2>
          <div className="space-y-4">
            {evaluation.categories.map((cat) => (
              <Card key={cat.key}>
                <div className="flex items-baseline justify-between mb-4 gap-3">
                  <h3 className="text-h4">{cat.label}</h3>
                  <span
                    className=""
                    style={{
                      fontSize: "2.25rem",
                      lineHeight: "1",
                      color:
                        cat.score === cat.max
                          ? "var(--color-green)"
                          : cat.score >= cat.max / 2
                            ? "var(--color-purple)"
                            : "var(--color-red)",
                    }}
                  >
                    {cat.score}
                    <span
                      className="text-small"
                      style={{
                        opacity: 0.5,
                        marginLeft: "0.25rem",
                        fontWeight: "normal",
                      }}
                    >
                      / {cat.max}
                    </span>
                  </span>
                </div>
                <ProgressBar value={cat.score} max={cat.max} />
                <ul className="mt-5 space-y-3">
                  {cat.criteria.map((c) => (
                    <li key={c.id} className="flex items-start gap-3">
                      <span
                        className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-pill text-meta font-bold mt-0.5"
                        style={{
                          background: c.passed
                            ? "var(--color-green)"
                            : "rgba(233, 75, 75, 0.12)",
                          color: c.passed
                            ? "var(--color-dark)"
                            : "var(--color-error)",
                        }}
                        aria-hidden="true"
                      >
                        {c.passed ? "✓" : "✗"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-small font-semibold"
                          style={{
                            color: c.passed
                              ? "var(--color-dark)"
                              : "var(--color-gray)",
                          }}
                        >
                          {c.label}
                        </div>
                        <div
                          className="text-meta mt-0.5"
                          style={{ color: "rgba(255, 255, 255, 0.65)", lineHeight: "1.4" }}
                        >
                          {c.comment}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* FORCES / IMPROVEMENTS / NEXT */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FeedbackList
          title="Ce que t'as bien fait"
          items={evaluation.strengths ?? []}
          tone="green"
        />
        <FeedbackList
          title="Là où tu peux grandir"
          items={evaluation.improvements ?? []}
          tone="warning"
        />
        <FeedbackList
          title="Ton plan pour la prochaine"
          items={evaluation.next_steps ?? []}
          tone="purple"
        />
      </section>

      {/* TRANSCRIPT */}
      {messagesList.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-h3">Transcript</h2>
          <Card variant="lavender">
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {messagesList.map((m) => (
                <div
                  key={m.id}
                  className={`text-small ${
                    m.role === "system" ? "italic opacity-70 text-center" : ""
                  }`}
                  style={{
                    color:
                      m.role === "user"
                        ? "var(--color-dark)"
                        : m.role === "prospect"
                          ? "var(--color-purple)"
                          : "var(--color-gray)",
                  }}
                >
                  {m.role !== "system" && (
                    <span className="font-semibold mr-2">
                      {m.role === "user" ? "Toi" : "Prospect"} :
                    </span>
                  )}
                  {m.content}
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* CTA */}
      <section className="flex justify-center gap-3 flex-wrap pt-4">
        {s.client_id && (
          <Link
            href={`/sessions/new?client=${s.client_id}`}
            className="btn btn-ghost"
          >
            Refaire pour ce client
          </Link>
        )}
        <Link href="/sessions/new" className="btn btn-primary">
          On en remet une
        </Link>
      </section>
    </div>
  );
}

// Rend l'outcome_summary en 5 bullets standardisés si le format est
// reconnaissable ("- [Libellé] : contenu"), sinon retombe sur un paragraphe
// classique pour rétrocompat avec les anciennes évaluations.
function OutcomeSummary({ text }: { text: string }) {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const bulletLines = lines.filter((l) => /^[-•*]\s*/.test(l));
  const isBulletFormat =
    lines.length >= 3 && bulletLines.length / lines.length > 0.6;

  if (!isBulletFormat) {
    return (
      <p
        className="text-body-l"
        style={{ color: "#FFFFFF", lineHeight: "1.5" }}
      >
        {text}
      </p>
    );
  }

  return (
    <ul className="outcome-summary-bullets">
      {bulletLines.map((line, idx) => {
        const stripped = line.replace(/^[-•*]\s*/, "");
        const labelMatch = stripped.match(/^\[([^\]]+)\]\s*:?\s*(.*)$/);
        const label = labelMatch ? labelMatch[1] : null;
        const body = labelMatch ? labelMatch[2] : stripped;
        return (
          <li key={idx}>
            {label && <span className="outcome-summary-label">{label}</span>}
            <span className="outcome-summary-body">{body}</span>
          </li>
        );
      })}
    </ul>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color =
    value === max
      ? "var(--color-green)"
      : value >= max / 2
        ? "var(--color-purple)"
        : "var(--color-red)";
  return (
    <div
      className="w-full h-2 rounded-pill overflow-hidden"
      style={{ background: "rgba(139, 127, 163, 0.16)" }}
    >
      <div
        className="h-full rounded-pill transition-all duration-slow ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

function FeedbackList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "green" | "warning" | "purple";
}) {
  const accent =
    tone === "green"
      ? "var(--color-green)"
      : tone === "warning"
        ? "var(--color-warning)"
        : "var(--color-purple)";
  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <span
          className="w-8 h-1 rounded-pill"
          style={{ background: accent }}
        />
        <h3 className="text-h4">{title}</h3>
      </div>
      <ul className="space-y-2.5">
        {items?.map((item, i) => (
          <li
            key={i}
            className="text-small flex gap-2"
            style={{ color: "#FFFFFF" }}
          >
            <span
              className="mt-1.5 w-1.5 h-1.5 rounded-pill flex-shrink-0"
              style={{ background: accent }}
              aria-hidden="true"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const CATEGORY_META: Record<
  CategoryKey,
  { label: string; color: string; icon: string }
> = {
  accroche: { label: "Accroche", color: "#3CC879", icon: "🎯" },
  decouverte: { label: "Découverte", color: "#4A8FE7", icon: "🔍" },
  valeur: { label: "Pitch & valeur", color: "#9d6bff", icon: "💡" },
  objections: { label: "Objection", color: "#F5A524", icon: "🛡️" },
  closing: { label: "Closing", color: "#E94B4B", icon: "🤝" },
};

function QuoteRewriteCard({ rewrite }: { rewrite: QuoteRewrite }) {
  const meta = CATEGORY_META[rewrite.category] ?? CATEGORY_META.objections;
  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: `linear-gradient(140deg, ${meta.color}1a 0%, rgba(34, 25, 50, 0.55) 100%)`,
        border: `1px solid ${meta.color}55`,
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span
          className="rounded-lg flex items-center justify-center"
          style={{
            width: 32,
            height: 32,
            background: `${meta.color}22`,
            fontSize: "1rem",
          }}
          aria-hidden="true"
        >
          {meta.icon}
        </span>
        <span
          style={{
            color: meta.color,
            fontSize: "0.62rem",
            letterSpacing: "0.18em",
            fontWeight: 700,
            textTransform: "uppercase",
          }}
        >
          {meta.label}
        </span>
        {rewrite.context && (
          <span
            className="text-meta"
            style={{
              color: "rgba(255, 255, 255, 0.55)",
              fontStyle: "italic",
            }}
          >
            · {rewrite.context}
          </span>
        )}
      </div>

      {/* Ce que tu as dit */}
      <div
        className="rounded-lg p-4 mb-3"
        style={{
          background: "rgba(233, 75, 75, 0.08)",
          border: "1px solid rgba(233, 75, 75, 0.22)",
        }}
      >
        <div
          style={{
            color: "#FFB4B4",
            fontSize: "0.62rem",
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Ce que tu as dit
        </div>
        <p
          style={{
            color: "#FFFFFF",
            fontSize: "0.95rem",
            lineHeight: 1.5,
            fontStyle: "italic",
          }}
        >
          «&nbsp;{rewrite.your_words}&nbsp;»
        </p>
        {rewrite.issue && (
          <p
            className="mt-2 text-small"
            style={{
              color: "rgba(255, 180, 180, 0.85)",
              lineHeight: 1.45,
            }}
          >
            <strong style={{ color: "#FFB4B4" }}>Pourquoi ça coince : </strong>
            {rewrite.issue}
          </p>
        )}
      </div>

      {/* Ce qu'il faudrait dire */}
      <div
        className="rounded-lg p-4"
        style={{
          background: "rgba(60, 200, 121, 0.10)",
          border: "1px solid rgba(60, 200, 121, 0.32)",
        }}
      >
        <div
          style={{
            color: "var(--color-green)",
            fontSize: "0.62rem",
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          ✓ Essaie plutôt
        </div>
        <p
          style={{
            color: "#FFFFFF",
            fontSize: "0.98rem",
            lineHeight: 1.5,
            fontWeight: 500,
          }}
        >
          «&nbsp;{rewrite.better}&nbsp;»
        </p>
      </div>
    </div>
  );
}
