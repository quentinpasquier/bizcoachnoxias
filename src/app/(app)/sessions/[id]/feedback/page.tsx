import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge, DifficultyBadge } from "@/components/ui/Badge";
import { createClient } from "@/lib/supabase/server";
import { formatDuration } from "@/lib/format";
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

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  if (!s.evaluation) {
    return <FeedbackEvaluator sessionId={id} />;
  }

  const evaluation = s.evaluation as Evaluation;
  const messagesList = (messages ?? []) as MessageRow[];
  const isLegacyFormat = !Array.isArray(evaluation.categories);

  return (
    <div className="container-noxias py-10 space-y-8 max-w-4xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <span className="divider-green block mb-3" />
          <h1 className="text-h2">Restitution</h1>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {s.client_name_snapshot && (
              <Badge tone="purple">{s.client_name_snapshot}</Badge>
            )}
            <span className="text-body" style={{ color: "var(--color-gray)" }}>
              {s.persona_label}
              {s.scenario_data && (
                <>
                  {" "}— {(s.scenario_data as { persona_name?: string }).persona_name ?? ""}
                </>
              )}
            </span>
            <DifficultyBadge difficulty={s.difficulty} />
            <span className="text-meta" style={{ color: "var(--color-gray)" }}>
              · {formatDuration(s.started_at, s.ended_at)}
            </span>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
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
        </div>
      </div>

      {/* Score global + outcome */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card variant="dark" className="md:col-span-1 flex flex-col items-center justify-center text-center py-10">
          <div
            className="text-meta uppercase tracking-widest mb-2"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            Score global
          </div>
          <div
            className="font-display"
            style={{
              fontSize: "6rem",
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
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            sur 100
          </div>
          {!isLegacyFormat && (
            <div
              className="text-meta mt-3"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              {evaluation.criteria_total ?? 0} / {evaluation.criteria_max ?? 20} critères validés
            </div>
          )}
        </Card>

        <Card className="md:col-span-2">
          <div className="flex items-center gap-3 mb-3">
            {s.appointment_secured ? (
              <span
                className="badge"
                style={{
                  background: "rgba(60, 200, 121, 0.18)",
                  color: "#1F6A3F",
                  fontSize: "1rem",
                  padding: "8px 16px",
                }}
              >
                ✓ RDV obtenu
              </span>
            ) : s.ended_by === "prospect" ? (
              <span
                className="badge"
                style={{
                  background: "rgba(233, 75, 75, 0.16)",
                  color: "#A61F1F",
                  fontSize: "1rem",
                  padding: "8px 16px",
                }}
              >
                ✗ Prospect a raccroché
              </span>
            ) : (
              <span
                className="badge"
                style={{
                  background: "rgba(139, 127, 163, 0.16)",
                  color: "var(--color-purple)",
                  fontSize: "1rem",
                  padding: "8px 16px",
                }}
              >
                Appel terminé
              </span>
            )}
          </div>
          <p className="text-body-l" style={{ color: "var(--color-dark)" }}>
            {evaluation.outcome_summary}
          </p>
        </Card>
      </div>

      {/* Catégories — nouveau format 20 critères */}
      {!isLegacyFormat && Array.isArray(evaluation.categories) && (
        <section>
          <h2 className="text-h3 mb-4">Détail par catégorie</h2>
          <div className="space-y-4">
            {evaluation.categories.map((cat) => (
              <Card key={cat.key}>
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="text-h4">{cat.label}</h3>
                  <span
                    className="font-display"
                    style={{
                      fontSize: "2rem",
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
                      style={{
                        fontSize: "0.875rem",
                        opacity: 0.5,
                        marginLeft: "0.25rem",
                      }}
                    >
                      /{cat.max}
                    </span>
                  </span>
                </div>
                <ProgressBar value={cat.score} max={cat.max} />
                <ul className="mt-4 space-y-2">
                  {cat.criteria.map((c) => (
                    <li key={c.id} className="flex items-start gap-3">
                      <span
                        className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-pill text-meta font-bold mt-0.5"
                        style={{
                          background: c.passed
                            ? "var(--color-green)"
                            : "rgba(233, 75, 75, 0.16)",
                          color: c.passed ? "var(--color-dark)" : "var(--color-error)",
                        }}
                      >
                        {c.passed ? "✓" : "✗"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-small font-medium"
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
                          style={{ color: "var(--color-gray)" }}
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

      {/* Forces / Améliorations / Next */}
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

      {/* Transcript */}
      {messagesList.length > 0 && (
        <section>
          <h2 className="text-h3 mb-4">Transcript</h2>
          <Card variant="lavender">
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {messagesList.map((m) => (
                <div
                  key={m.id}
                  className={`text-small ${
                    m.role === "system"
                      ? "italic opacity-70 text-center"
                      : ""
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
                    <span className="font-medium">
                      {m.role === "user" ? "Toi : " : "Prospect : "}
                    </span>
                  )}
                  {m.content}
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}
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
      style={{ background: "rgba(139, 127, 163, 0.2)" }}
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
      <div className="flex items-center gap-2 mb-3">
        <span
          className="w-8 h-0.5 rounded-pill"
          style={{ background: accent }}
        />
        <h3 className="text-h4">{title}</h3>
      </div>
      <ul className="space-y-2">
        {items?.map((item, i) => (
          <li
            key={i}
            className="text-small flex gap-2"
            style={{ color: "var(--color-dark)" }}
          >
            <span style={{ color: accent }}>—</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
