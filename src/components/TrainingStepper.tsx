import Link from "next/link";

// Stepper visible sur les 3 premières étapes du tunnel d'entraînement
// (Mode → Config → Briefing → Mission). La 4e étape (Mission) est en
// plein écran focus, le stepper n'y apparaît pas.
//
// Cliquable pour revenir aux étapes précédentes :
//   - Étape "Mode" : lien vers /sessions/new (sans param) si on est à
//     une étape ≥ 2
//   - Étape "Config" : lien vers /sessions/new?mode=X si on est à
//     l'étape "Briefing"
//   - Les étapes futures ne sont pas cliquables
//
// L'étape active est highlightée avec var(--mode-accent) → hérite de
// la teinte du mode posée sur le container parent (training-theme-X).

export type StepperStep = "mode" | "config" | "briefing" | "mission";

interface TrainingStepperProps {
  currentStep: StepperStep;
  /** Mode d'entraînement choisi (utile pour reconstruire le lien Config). */
  trainingMode?: "full" | "block" | "embedded" | null;
}

const STEPS: { key: StepperStep; label: string; subtitle: string }[] = [
  { key: "mode", label: "Mode", subtitle: "Choix" },
  { key: "config", label: "Config", subtitle: "Paramètres" },
  { key: "briefing", label: "Briefing", subtitle: "Préparation" },
  { key: "mission", label: "Mission", subtitle: "Appel" },
];

export function TrainingStepper({
  currentStep,
  trainingMode = null,
}: TrainingStepperProps) {
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);

  function linkFor(step: StepperStep, idx: number): string | null {
    // Seules les étapes PRÉCÉDENTES sont cliquables, pour permettre de
    // revenir en arrière sans casser le flow.
    if (idx >= currentIdx) return null;
    if (step === "mode") return "/sessions/new";
    if (step === "config" && trainingMode)
      return `/sessions/new?mode=${trainingMode}`;
    return null;
  }

  return (
    <nav
      className="training-stepper"
      aria-label="Progression de l'entraînement"
    >
      <ol className="training-stepper-list">
        {STEPS.map((s, idx) => {
          const state =
            idx < currentIdx ? "done" : idx === currentIdx ? "current" : "todo";
          const href = linkFor(s.key, idx);
          const content = (
            <>
              <span
                className="training-stepper-dot"
                aria-hidden="true"
              >
                {state === "done" ? "✓" : idx + 1}
              </span>
              <span className="training-stepper-text">
                <span className="training-stepper-label">{s.label}</span>
                <span className="training-stepper-sub">{s.subtitle}</span>
              </span>
            </>
          );

          return (
            <li
              key={s.key}
              className={`training-stepper-step training-stepper-step-${state}`}
            >
              {href ? (
                <Link
                  href={href}
                  className="training-stepper-step-link"
                  aria-label={`Revenir à l'étape ${s.label}`}
                >
                  {content}
                </Link>
              ) : (
                <div
                  className="training-stepper-step-link training-stepper-step-static"
                  aria-current={state === "current" ? "step" : undefined}
                >
                  {content}
                </div>
              )}
              {idx < STEPS.length - 1 && (
                <div
                  className="training-stepper-connector"
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
