"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

const STEPS = [
  { label: "Lecture du transcript...", duration: 2500 },
  { label: "Comptage des critères validés...", duration: 3500 },
  { label: "Analyse de la gestion des objections...", duration: 3000 },
  { label: "Calcul du score...", duration: 2000 },
  { label: "Rédaction du débrief...", duration: 3000 },
  { label: "Presque prêt...", duration: 4000 },
];

const FACTS = [
  "Un cold call B2B se joue dans les 30 premières secondes.",
  "80 % des RDV se décrochent à partir de la 4e relance, pas à la 1re.",
  "Les meilleurs commerciaux parlent 43 % du temps, pas plus (source Gong).",
  "Acquitter l'objection avant de répondre double le taux de RDV.",
  "Un créneau précis (jour + heure) convertit 2× mieux que « quand vous voulez ».",
  "Le mail de doc envoyé sans RDV verbal convertit à moins de 2 %.",
  "Les questions ouvertes génèrent 2× plus d'engagement que les fermées.",
  "Le top 10 % des SDR tient en moyenne 5 objections avant de lâcher.",
];

export function FeedbackEvaluator({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [factIdx, setFactIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [attempt, setAttempt] = useState(1);
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current) return;
    triggered.current = true;
    void run(1);
    async function run(currentAttempt: number) {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/evaluate`, {
          method: "POST",
        });
        if (!res.ok) {
          // Si timeout (504) ou erreur 5xx, on retry jusqu'à 3 fois
          const isRetryable =
            res.status === 504 ||
            res.status === 502 ||
            res.status === 503 ||
            res.status >= 500;
          if (isRetryable && currentAttempt < 3) {
            setAttempt(currentAttempt + 1);
            // petite pause avant retry, le serveur a peut-être besoin de souffler
            await new Promise((r) => setTimeout(r, 1500));
            return run(currentAttempt + 1);
          }
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.error ?? `Le débrief n'a pas pu être généré (HTTP ${res.status}).`,
          );
        }
        router.refresh();
      } catch (err) {
        // Erreur réseau / fetch failed : on retry aussi
        if (currentAttempt < 3) {
          setAttempt(currentAttempt + 1);
          await new Promise((r) => setTimeout(r, 1500));
          return run(currentAttempt + 1);
        }
        setError((err as Error).message);
      }
    }
  }, [sessionId, router]);

  // Steps qui défilent
  useEffect(() => {
    if (error) return;
    if (stepIdx >= STEPS.length - 1) return;
    const t = setTimeout(
      () => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1)),
      STEPS[stepIdx]!.duration,
    );
    return () => clearTimeout(t);
  }, [stepIdx, error]);

  // Faits qui changent
  useEffect(() => {
    if (error) return;
    const t = setInterval(() => {
      setFactIdx((i) => (i + 1) % FACTS.length);
    }, 5500);
    return () => clearInterval(t);
  }, [error]);

  // Compteur de temps écoulé
  useEffect(() => {
    if (error) return;
    const start = performance.now();
    const t = setInterval(() => {
      setElapsed((performance.now() - start) / 1000);
    }, 100);
    return () => clearInterval(t);
  }, [error]);

  // Progress visuel : combine step actuel + sa progression interne
  const totalDuration = STEPS.reduce((acc, s) => acc + s.duration, 0);
  const elapsedMs = elapsed * 1000;
  const progressPct = Math.min(96, (elapsedMs / totalDuration) * 100);

  if (error) {
    return (
      <div className="container-noxias py-16 max-w-2xl">
        <div className="ui-card ui-card-padded text-center space-y-4 py-12">
          <p className="text-h3" style={{ color: "#FFB4B4" }}>
            Le débrief a échoué.
          </p>
          <p style={{ color: "rgba(255, 255, 255, 0.65)" }}>{error}</p>
          <Button onClick={() => location.reload()} variant="primary">
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-noxias py-12 max-w-3xl">
      <div className="evaluator-card">
        {/* Étoiles d'ambiance */}
        <span className="evaluator-stars" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </span>

        <div className="evaluator-grid">
          {/* Colonne gauche : avatar / animation */}
          <div className="evaluator-avatar">
            <div className="evaluator-ring evaluator-ring-1" />
            <div className="evaluator-ring evaluator-ring-2" />
            <div className="evaluator-ring evaluator-ring-3" />
            <div className="evaluator-pulse">
              <span aria-hidden="true">🤖</span>
            </div>
          </div>

          {/* Colonne droite : steps + facts */}
          <div className="evaluator-content">
            <div className="eyebrow-green">Débrief en cours</div>
            <h1
              className="text-h2"
              style={{ color: "#FFFFFF", margin: "8px 0 6px", fontSize: "1.6rem" }}
            >
              L&apos;IA analyse votre appel.
            </h1>
            <p
              className="text-small"
              style={{ color: "rgba(255, 255, 255, 0.6)" }}
            >
              Habituellement 10 à 30 secondes, jusqu&apos;à 1 minute sur un transcript long.
              {attempt > 1 && (
                <span
                  style={{
                    color: "#F7C041",
                    marginLeft: 8,
                    fontWeight: 700,
                  }}
                >
                  · Nouvelle tentative ({attempt}/3)
                </span>
              )}
            </p>

            <ul className="evaluator-steps">
              {STEPS.map((s, i) => (
                <li
                  key={i}
                  className={`evaluator-step ${
                    i < stepIdx
                      ? "evaluator-step-done"
                      : i === stepIdx
                        ? "evaluator-step-active"
                        : ""
                  }`}
                >
                  <span className="evaluator-step-icon" aria-hidden="true">
                    {i < stepIdx ? "✓" : i === stepIdx ? "" : ""}
                  </span>
                  <span>{s.label}</span>
                </li>
              ))}
            </ul>

            <div className="evaluator-progress">
              <div
                className="evaluator-progress-bar"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div
              className="text-meta mt-2 flex items-center justify-between"
              style={{ color: "rgba(255, 255, 255, 0.45)" }}
            >
              <span>{elapsed.toFixed(1)} s</span>
              <span>{Math.round(progressPct)} %</span>
            </div>
          </div>
        </div>

        {/* Faits qui défilent */}
        <div className="evaluator-fact">
          <span
            style={{
              color: "#F7C041",
              fontSize: "0.65rem",
              letterSpacing: "0.18em",
              fontWeight: 700,
              textTransform: "uppercase",
              marginRight: 10,
            }}
          >
            💡 Le savais-tu ?
          </span>
          <span
            key={factIdx}
            style={{
              color: "rgba(255, 255, 255, 0.82)",
              fontSize: "0.92rem",
              animation: "evaluatorFactFade 0.5s ease-out",
            }}
          >
            {FACTS[factIdx]}
          </span>
        </div>
      </div>
    </div>
  );
}
