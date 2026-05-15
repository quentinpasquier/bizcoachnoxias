"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "bizcoach_onboarding_seen_v2";

interface Step {
  eyebrow: string;
  title: string;
  body: string;
  accent: string;
  emoji: string;
}

const STEPS: Step[] = [
  {
    eyebrow: "Étape 1",
    title: "Tu pratiques le cold call avec une IA",
    body: "Chaque session, tu appelles un prospect simulé sur un client réel. L'IA joue le rôle d'un décideur occupé, sceptique ou hostile selon le niveau. L'objectif : décrocher un RDV en 3 à 6 minutes.",
    accent: "#3CC879",
    emoji: "📞",
  },
  {
    eyebrow: "Étape 2",
    title: "Tu es noté sur 20 critères cold call",
    body: "Accroche, découverte, valeur, objections, closing. Chaque critère compte 1 point, le score est sur 100. Si tu décroches un RDV, ton score est automatiquement ≥ 50.",
    accent: "#9d6bff",
    emoji: "🎯",
  },
  {
    eyebrow: "Étape 3",
    title: "Ton rang monte et descend selon tes perfs",
    body: "Tu commences à Bronze I. Chaque session te rapporte ou te coûte des Practis Points (PPN). Un RDV = +30 PPN, un sans-faute = +20 PPN, un raccrochage = −10 PPN. 6 tiers, 24 rangs, jusqu'à Master IV.",
    accent: "#F7C041",
    emoji: "🏆",
  },
  {
    eyebrow: "Étape 4",
    title: "Une récompense chaque fin de mois",
    body: "Selon le rang sur lequel tu termines le mois, tu reçois une récompense : 1 € à Bronze I, jusqu'à 30 € à Master IV. Plus tu progresses, plus la récompense grossit. À toi de te maintenir au sommet.",
    accent: "#3CC879",
    emoji: "🎁",
  },
  {
    eyebrow: "Étape 5",
    title: "30 minutes par jour suffisent",
    body: "Ton quota quotidien est de 30 min. Tu vois ton avancement en temps réel sur le dashboard. Tu maintiens une série en pratiquant chaque jour. Les missions du jour te donnent des objectifs précis.",
    accent: "#4A8FE7",
    emoji: "⏱️",
  },
  {
    eyebrow: "Étape 6",
    title: "Tu reçois un briefing avant chaque appel",
    body: "Avant de décrocher, tu reçois un dossier complet : cible, douleurs cachées, KPI surveillés, objections probables. Le but : arriver préparé, pas découvrir le prospect en direct.",
    accent: "#E94B4B",
    emoji: "🕵️",
  },
];

export function OnboardingGuide({
  forceOpen = false,
  onClose,
}: {
  forceOpen?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(forceOpen);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      setStep(0);
      return;
    }
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      setOpen(true);
    }
  }, [forceOpen]);

  function handleClose() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "1");
    }
    setOpen(false);
    onClose?.();
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleClose();
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  if (!open) return null;

  const s = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="onboarding-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Comment ça marche"
    >
      <div className="onboarding-card">
        <button
          type="button"
          onClick={handleClose}
          className="onboarding-close"
          aria-label="Fermer"
        >
          ×
        </button>

        <div className="onboarding-progress">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`onboarding-dot ${i === step ? "onboarding-dot-active" : ""} ${
                i < step ? "onboarding-dot-done" : ""
              }`}
              style={{
                background:
                  i === step
                    ? s.accent
                    : i < step
                      ? "rgba(60,200,121,0.5)"
                      : "rgba(255,255,255,0.15)",
              }}
            />
          ))}
        </div>

        <div className="onboarding-emoji" aria-hidden="true">
          {s.emoji}
        </div>

        <span className="onboarding-eyebrow" style={{ color: s.accent }}>
          {s.eyebrow}
        </span>
        <h2 className="onboarding-title">{s.title}</h2>
        <p className="onboarding-body">{s.body}</p>

        <div className="onboarding-actions">
          <button
            type="button"
            onClick={prev}
            disabled={step === 0}
            className="onboarding-btn-ghost"
            style={{ visibility: step === 0 ? "hidden" : "visible" }}
          >
            ← Précédent
          </button>
          <span className="onboarding-counter">
            {step + 1} / {STEPS.length}
          </span>
          <button
            type="button"
            onClick={next}
            className="onboarding-btn-primary"
            style={{
              background: `linear-gradient(135deg, ${s.accent}, ${s.accent}cc)`,
            }}
          >
            {isLast ? "C'est parti →" : "Suivant →"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function OnboardingTrigger() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-meta uppercase tracking-widest rounded-full px-3 py-1 transition"
        style={{
          background: "rgba(255, 255, 255, 0.08)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          color: "rgba(255, 255, 255, 0.65)",
          fontWeight: 700,
          fontSize: "0.65rem",
        }}
      >
        ? Guide
      </button>
      {open && (
        <OnboardingGuide forceOpen onClose={() => setOpen(false)} />
      )}
    </>
  );
}
