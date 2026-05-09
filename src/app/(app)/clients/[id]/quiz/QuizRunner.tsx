"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Loader } from "@/components/Loader";
import {
  QUIZ_CATEGORY_COLORS,
  QUIZ_CATEGORY_LABELS,
} from "@/lib/client-quiz";
import type { QuizData, QuizQuestion } from "@/lib/supabase/types";

interface Props {
  clientId: string;
  initialQuiz: QuizData | null;
}

type Phase = "idle" | "running" | "done";

export function QuizRunner({ clientId, initialQuiz }: Props) {
  const [quiz, setQuiz] = useState<QuizData | null>(initialQuiz);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [finalScore, setFinalScore] = useState<{
    score: number;
    correct_answers: number;
    total_questions: number;
  } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const questions = quiz?.questions ?? [];

  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id] !== undefined).length,
    [questions, answers],
  );

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/quiz`, {
        method: "POST",
      });
      let payload: { quiz?: QuizData; error?: string } = {};
      const text = await res.text();
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(
          `Réponse non-JSON (HTTP ${res.status}) : ${text.slice(0, 220) || "(corps vide)"}`,
        );
      }
      if (!res.ok) {
        throw new Error(payload.error ?? `HTTP ${res.status} sans détail`);
      }
      if (!payload.quiz) {
        throw new Error("La réponse ne contient pas de quiz.");
      }
      setQuiz(payload.quiz);
    } catch (e) {
      setGenError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  function handleStart() {
    setAnswers({});
    setRevealed({});
    setFinalScore(null);
    setStartedAt(new Date().toISOString());
    setPhase("running");
  }

  function handleSelect(question: QuizQuestion, optionIdx: number) {
    if (revealed[question.id]) return;
    setAnswers((a) => ({ ...a, [question.id]: optionIdx }));
    setRevealed((r) => ({ ...r, [question.id]: true }));
  }

  async function handleSubmit() {
    if (!quiz) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        started_at: startedAt,
        answers: Object.entries(answers).map(([qid, idx]) => ({
          question_id: qid,
          selected_index: idx,
        })),
      };
      const res = await fetch(`/api/clients/${clientId}/quiz/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        score?: number;
        correct_answers?: number;
        total_questions?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Erreur enregistrement");
      }
      setFinalScore({
        score: data.score ?? 0,
        correct_answers: data.correct_answers ?? 0,
        total_questions: data.total_questions ?? questions.length,
      });
      setPhase("done");
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // ====== ÉCRANS ======

  if (!quiz) {
    return (
      <Card variant="lavender" className="text-center py-12">
        <h3 className="text-h3 mb-2">Génère le quiz</h3>
        <p
          className="text-body mb-6"
          style={{ color: "var(--color-gray)" }}
        >
          Claude va lire les docs du client et préparer 12 questions.
        </p>
        {genError && (
          <div
            className="mb-4 mx-auto max-w-2xl text-left rounded-md px-4 py-3 text-small"
            style={{
              background: "rgba(233, 75, 75, 0.08)",
              color: "#A61F1F",
              border: "1px solid rgba(233, 75, 75, 0.24)",
              whiteSpace: "pre-wrap",
            }}
          >
            <strong>Erreur :</strong> {genError}
          </div>
        )}
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="btn btn-primary"
        >
          {generating ? "Génération en cours..." : "Générer le quiz"}
        </button>
        {generating && (
          <div className="mt-6 flex justify-center">
            <Loader size="md" />
          </div>
        )}
      </Card>
    );
  }

  if (phase === "idle") {
    return (
      <Card>
        <div className="text-center py-6">
          <div className="eyebrow-green mb-3">
            {questions.length} question{questions.length > 1 ? "s" : ""}
          </div>
          <h3 className="text-h2 mb-3">Prêt à valider tes acquis ?</h3>
          <p
            className="text-body mb-6"
            style={{ color: "var(--color-gray)" }}
          >
            Tu auras un retour immédiat à chaque réponse. Score final à la fin.
            Tu peux refaire le quiz autant de fois que tu veux.
          </p>
          <button onClick={handleStart} className="btn btn-primary">
            Lance le quiz
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn btn-ghost ml-3"
          >
            {generating ? "..." : "Régénérer le quiz"}
          </button>
        </div>
      </Card>
    );
  }

  if (phase === "done" && finalScore) {
    const { score, correct_answers, total_questions } = finalScore;
    const tone =
      score >= 80
        ? { color: "var(--color-green)", label: "Excellent. Tu maîtrises." }
        : score >= 60
          ? { color: "var(--color-purple)", label: "Bonne base. Quelques angles à creuser." }
          : { color: "var(--color-warning)", label: "Repasse les docs avant ton premier appel." };

    const byCategory = aggregateByCategory(questions, answers);

    return (
      <div className="space-y-6">
        <Card variant="dark" className="text-center">
          <div
            className="eyebrow"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Score final
          </div>
          <div
            style={{
              fontSize: "5rem",
              lineHeight: "1",
              color: tone.color,
              fontWeight: 600,
              marginTop: "8px",
            }}
          >
            {score}
            <span
              style={{
                fontSize: "1.5rem",
                opacity: 0.55,
                marginLeft: "6px",
                fontWeight: 400,
              }}
            >
              /100
            </span>
          </div>
          <p
            className="text-body mt-3"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            {correct_answers}/{total_questions} bonnes réponses
          </p>
          <p
            className="text-body-l mt-2"
            style={{ color: tone.color, fontWeight: 600 }}
          >
            {tone.label}
          </p>
        </Card>

        <Card>
          <h3 className="text-h3 mb-4">Détail par catégorie</h3>
          <div className="space-y-3">
            {byCategory.map((c) => (
              <div key={c.category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-small" style={{ fontWeight: 600 }}>
                    {QUIZ_CATEGORY_LABELS[c.category]}
                  </span>
                  <span
                    className="text-small"
                    style={{ color: "var(--color-gray)" }}
                  >
                    {c.correct}/{c.total}
                  </span>
                </div>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ background: "rgba(139, 127, 163, 0.16)" }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${c.total > 0 ? (c.correct / c.total) * 100 : 0}%`,
                      background: QUIZ_CATEGORY_COLORS[c.category],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-h3 mb-4">Ce que tu as raté</h3>
          {questions
            .filter((q) => answers[q.id] !== q.correct_index)
            .map((q) => (
              <div
                key={q.id}
                className="py-4 border-b last:border-0"
                style={{ borderColor: "var(--color-gray-border)" }}
              >
                <div
                  className="text-meta uppercase tracking-widest mb-1"
                  style={{ color: QUIZ_CATEGORY_COLORS[q.category] }}
                >
                  {QUIZ_CATEGORY_LABELS[q.category]}
                </div>
                <p className="text-body" style={{ fontWeight: 500 }}>
                  {q.question}
                </p>
                <p
                  className="text-small mt-2"
                  style={{ color: "var(--color-error)" }}
                >
                  Ta réponse : {q.options[answers[q.id]] ?? "(pas répondue)"}
                </p>
                <p
                  className="text-small mt-1"
                  style={{ color: "var(--color-green)", fontWeight: 600 }}
                >
                  Bonne réponse : {q.options[q.correct_index]}
                </p>
                {q.explanation && (
                  <p
                    className="text-small mt-2"
                    style={{ color: "var(--color-gray)" }}
                  >
                    {q.explanation}
                  </p>
                )}
              </div>
            ))}
          {questions.every((q) => answers[q.id] === q.correct_index) && (
            <p style={{ color: "var(--color-green)", fontWeight: 600 }}>
              Sans-faute. Bravo.
            </p>
          )}
        </Card>

        <div className="flex gap-3 flex-wrap">
          <button onClick={handleStart} className="btn btn-primary">
            Refaire le quiz
          </button>
          <Link href={`/clients/${clientId}`} className="btn btn-ghost">
            Retour au client
          </Link>
        </div>
      </div>
    );
  }

  // phase === "running"
  return (
    <div className="space-y-5">
      <ProgressBar value={answeredCount} max={questions.length} />

      {questions.map((q, idx) => {
        const selected = answers[q.id];
        const isRevealed = revealed[q.id];
        const correctIdx = q.correct_index;
        return (
          <Card key={q.id} hoverable={false}>
            <div
              className="text-meta uppercase tracking-widest mb-2"
              style={{ color: QUIZ_CATEGORY_COLORS[q.category] }}
            >
              {idx + 1}/{questions.length} · {QUIZ_CATEGORY_LABELS[q.category]}
            </div>
            <p
              className="text-h4 mb-4"
              style={{ color: "var(--color-dark)" }}
            >
              {q.question}
            </p>
            <div className="space-y-2">
              {q.options.map((opt, optIdx) => {
                const isSelected = selected === optIdx;
                const isCorrect = optIdx === correctIdx;
                let bg = "var(--bg-soft)";
                let border = "var(--color-gray-border)";
                let color = "var(--color-dark)";
                if (isRevealed) {
                  if (isCorrect) {
                    bg = "rgba(60, 200, 121, 0.12)";
                    border = "rgba(60, 200, 121, 0.5)";
                    color = "#1F6A3F";
                  } else if (isSelected) {
                    bg = "rgba(233, 75, 75, 0.10)";
                    border = "rgba(233, 75, 75, 0.4)";
                    color = "#A61F1F";
                  } else {
                    bg = "transparent";
                  }
                } else if (isSelected) {
                  bg = "rgba(60, 200, 121, 0.10)";
                  border = "var(--color-green)";
                }
                return (
                  <button
                    key={optIdx}
                    type="button"
                    onClick={() => handleSelect(q, optIdx)}
                    disabled={isRevealed}
                    className="w-full text-left rounded-md px-4 py-3 transition flex items-center gap-3"
                    style={{
                      background: bg,
                      border: `1px solid ${border}`,
                      color,
                      cursor: isRevealed ? "default" : "pointer",
                    }}
                  >
                    <span
                      className="rounded-full flex items-center justify-center font-semibold shrink-0"
                      style={{
                        width: 26,
                        height: 26,
                        fontSize: "0.85rem",
                        background:
                          isRevealed && isCorrect
                            ? "var(--color-green)"
                            : isRevealed && isSelected
                              ? "var(--color-error)"
                              : "rgba(139, 127, 163, 0.12)",
                        color:
                          isRevealed && (isCorrect || isSelected)
                            ? "#FFFFFF"
                            : "var(--color-purple)",
                      }}
                    >
                      {String.fromCharCode(65 + optIdx)}
                    </span>
                    <span className="flex-1">{opt}</span>
                    {isRevealed && isCorrect && (
                      <CheckIcon />
                    )}
                  </button>
                );
              })}
            </div>
            {isRevealed && q.explanation && (
              <div
                className="mt-3 px-4 py-3 rounded-md text-small"
                style={{
                  background: "var(--color-lavender)",
                  color: "var(--color-dark)",
                }}
              >
                <strong style={{ color: "var(--color-purple)" }}>
                  Pourquoi ?
                </strong>{" "}
                {q.explanation}
              </div>
            )}
          </Card>
        );
      })}

      {submitError && (
        <p
          className="text-small px-3 py-2 rounded-md"
          style={{
            background: "rgba(233, 75, 75, 0.08)",
            color: "var(--color-error)",
          }}
        >
          {submitError}
        </p>
      )}

      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={submitting || answeredCount < questions.length}
          className="btn btn-primary"
          style={{ boxShadow: "var(--shadow-lg)" }}
        >
          {submitting
            ? "Enregistrement..."
            : answeredCount < questions.length
              ? `Réponds à toutes les questions (${answeredCount}/${questions.length})`
              : "Voir mon score"}
        </button>
      </div>
    </div>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div
      className="sticky top-16 z-10 -mx-1 px-1 py-2"
      style={{ background: "var(--bg-app)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex-1 h-1.5 rounded-full overflow-hidden"
          style={{ background: "rgba(139, 127, 163, 0.16)" }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background:
                "linear-gradient(90deg, var(--color-purple), var(--color-green))",
            }}
          />
        </div>
        <span
          className="text-meta uppercase tracking-widest"
          style={{ color: "var(--color-gray)" }}
        >
          {value}/{max}
        </span>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function aggregateByCategory(
  questions: QuizQuestion[],
  answers: Record<string, number>,
) {
  const order: QuizQuestion["category"][] = [
    "qui",
    "pourquoi",
    "quoi",
    "douleurs",
    "objections",
  ];
  return order
    .map((cat) => {
      const inCat = questions.filter((q) => q.category === cat);
      const correct = inCat.filter((q) => answers[q.id] === q.correct_index)
        .length;
      return { category: cat, total: inCat.length, correct };
    })
    .filter((c) => c.total > 0);
}
