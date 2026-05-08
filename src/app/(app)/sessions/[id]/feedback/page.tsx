import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge, DifficultyBadge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import { formatDateTimeFr, formatDuration } from "@/lib/format";
import type { Evaluation, MessageRow, SessionRow } from "@/lib/supabase/types";
import { FeedbackEvaluator } from "./FeedbackEvaluator";

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .single();

  if (!session) notFound();
  const s = session as SessionRow;
  if (s.status === "active") redirect(`/sessions/${id}`);

  const [{ data: messages }, { data: profileData }] = await Promise.all([
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
  ]);

  if (!s.evaluation) {
    return <FeedbackEvaluator sessionId={id} />;
  }

  const evaluation = s.evaluation as Evaluation;
  const messagesList = (messages ?? []) as MessageRow[];
  const isLegacyFormat = !Array.isArray(evaluation.categories);
  const author = (profileData as { full_name?: string | null } | null)?.full_name ?? "Anonyme";

  const personaName = (s.scenario_data as { persona_name?: string } | null)?.persona_name ?? "";

  return (
    <div className="container-noxias py-12 space-y-12 max-w-4xl">
      {/* HERO */}
      <header>
        <Link
          href="/history"
          className="text-small hover:underline inline-flex items-center gap-1 mb-6"
          style={{ color: "var(--color-gray)" }}
        >
          ← Retour à l&apos;historique
        </Link>
        <span className="divider-green block mb-4" />
        <h1 className="text-h2">Restitution</h1>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          {s.client_name_snapshot && (
            <Badge tone="purple">{s.client_name_snapshot}</Badge>
          )}
          <span className="text-body" style={{ color: "var(--color-dark)" }}>
            {s.persona_label}
            {personaName && (
              <span style={{ color: "var(--color-gray)" }}> · {personaName}</span>
            )}
          </span>
          <DifficultyBadge difficulty={s.difficulty} />
        </div>
        <div className="mt-2 flex items-center gap-3 flex-wrap text-small" style={{ color: "var(--color-gray)" }}>
          <span style={{ color: "var(--color-dark)", fontWeight: 500 }}>{author}</span>
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
            Score global
          </div>
          <div
            className="font-display"
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
          <p
            className="text-body-l"
            style={{ color: "var(--color-dark)", lineHeight: "1.5" }}
          >
            {evaluation.outcome_summary}
          </p>
        </Card>
      </section>

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
                    className="font-display"
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
                          style={{ color: "var(--color-gray)", lineHeight: "1.4" }}
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
          title="Tes forces"
          items={evaluation.strengths ?? []}
          tone="green"
        />
        <FeedbackList
          title="Axes d'amélioration"
          items={evaluation.improvements ?? []}
          tone="warning"
        />
        <FeedbackList
          title="Prochaines actions"
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
          Nouvelle session
        </Link>
      </section>
    </div>
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
            style={{ color: "var(--color-dark)" }}
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
