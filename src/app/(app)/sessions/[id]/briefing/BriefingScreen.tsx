"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CamilleMascot } from "@/components/CamilleMascot";
import { TrainingStepper } from "@/components/TrainingStepper";
import { FlashBriefing } from "./FlashBriefing";
import type {
  Client,
  PersonaProfile,
  SessionRow,
  Difficulty,
} from "@/lib/supabase/types";

interface DifficultyConfig {
  label: string;
  description: string;
  behaviorRules: string;
  hangupRules: string;
  rdvCriteria: string;
}

interface Props {
  sessionId: string;
  session: SessionRow;
  client: Client | null;
  persona: PersonaProfile | null;
  difficultyConfig: DifficultyConfig;
}

const DIFFICULTY_STARS: Record<Difficulty, number> = {
  debutant: 1,
  intermediaire: 2,
  avance: 3,
  expert: 4,
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  debutant: "#3CC879",
  intermediaire: "#4A8FE7",
  avance: "#F5A524",
  expert: "#E94B4B",
};

export function BriefingScreen({
  sessionId,
  session,
  client,
  persona,
  difficultyConfig,
}: Props) {
  const router = useRouter();
  const [countdown, setCountdown] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);

  const scenario = session.scenario_data;
  const difficulty = session.difficulty as Difficulty;
  const stars = DIFFICULTY_STARS[difficulty];
  const diffColor = DIFFICULTY_COLORS[difficulty];

  const personaName = scenario?.persona_name ?? persona?.label ?? "Cible";
  const personaRole = scenario?.persona_role ?? persona?.role ?? "";
  const company =
    scenario?.company_name ?? persona?.typical_company ?? "Société inconnue";
  const context = scenario?.company_context ?? "";
  const situation = scenario?.current_situation ?? "";
  const hiddenPains = scenario?.hidden_pain_points ?? [];
  const kpis = scenario?.kpis_to_probe ?? [];
  const objections = scenario?.available_objections ?? [];

  // Compte à rebours
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      router.push(`/sessions/${sessionId}`);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c ?? 0) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, router, sessionId]);

  // Mode drill flash : fiche compacte 1 écran, pas de briefing immersif.
  // L'early-return est placé APRÈS tous les hooks pour respecter les
  // rules-of-hooks (utiliser un sous-composant à la place plutôt qu'un
  // gros if/else qui dépaint le code du briefing classique).
  if (
    session.training_mode === "block" &&
    session.block_target &&
    session.scenario_data?.flash_meta
  ) {
    return <FlashBriefing sessionId={sessionId} session={session} />;
  }

  function handleAccept() {
    setStarting(true);
    setCountdown(3);
  }

  return (
    <div className="relative">
      <div className="briefing-blob briefing-blob-1" aria-hidden="true" />
      <div className="briefing-blob briefing-blob-2" aria-hidden="true" />

      <div className="container-noxias relative z-10 py-8 lg:py-12 space-y-8">
        {/* Stepper du tunnel d'entraînement (étape 3/4 : Briefing). */}
        <TrainingStepper
          currentStep="briefing"
          trainingMode={session.training_mode ?? "full"}
        />

        {/* En-tête CLASSIFIED */}
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="briefing-classified-tag">
              <DotPulse />
              CLASSIFIÉ · NIVEAU NOXIAS
            </span>
            <span
              className="briefing-mission-id"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              MISSION #{sessionId.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <Link
            href="/sessions/new"
            className="text-small"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            ← Refuser la mission
          </Link>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 lg:gap-8">
          {/* COLONNE GAUCHE : DOSSIER */}
          <div className="briefing-card">
            <span className="briefing-scan" aria-hidden="true" />
            <div className="briefing-card-inner space-y-6">
              <div className="flex items-start gap-4">
                <CamilleMascot
                  state={countdown !== null ? "thinking" : "idle"}
                  size={72}
                  withHalo
                />
                <div className="flex-1 min-w-0">
                  <span
                    className="briefing-eyebrow"
                    style={{ color: diffColor }}
                  >
                    Quentin te briefe · {difficultyConfig.label}{" "}
                    <DifficultyStars stars={stars} color={diffColor} />
                  </span>
                  <h1 className="briefing-h1">
                    Briefing<br />
                    <span style={{ color: "var(--color-green)" }}>mission</span>
                  </h1>
                  <p className="briefing-pitch-line">
                    Tu vas appeler <strong>{personaName}</strong>
                    {personaRole ? `, ${personaRole}` : ""} chez{" "}
                    <strong>{company}</strong>. Ton objectif : décrocher un RDV.
                  </p>
                </div>
              </div>

              {/* Cible identifiée */}
              <Block label="Cible identifiée">
                <div className="flex items-center gap-4">
                  <div className="briefing-target-portrait">
                    <span aria-hidden="true">{initialsFrom(personaName)}</span>
                  </div>
                  <div>
                    <div className="briefing-target-name">{personaName}</div>
                    <div className="briefing-target-role">{personaRole}</div>
                    <div className="briefing-target-company">{company}</div>
                  </div>
                </div>
              </Block>

              {context && (
                <Block label="Contexte entreprise">
                  <p className="briefing-paragraph">{context}</p>
                </Block>
              )}

              {situation && (
                <Block label="Situation actuelle">
                  <p className="briefing-paragraph">{situation}</p>
                </Block>
              )}

              {hiddenPains.length > 0 && (
                <Block
                  label="Douleurs cachées"
                  hint="À déterrer, le prospect ne les annonce pas."
                >
                  <ul className="briefing-list">
                    {hiddenPains.map((p, i) => (
                      <li key={i} className="briefing-list-item briefing-hidden">
                        <span className="briefing-list-bullet">?</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </Block>
              )}

              {kpis.length > 0 && (
                <Block label="KPI qu'il surveille" hint="Ses chiffres clés.">
                  <ul className="briefing-list">
                    {kpis.map((k, i) => (
                      <li key={i} className="briefing-list-item">
                        <span className="briefing-list-bullet briefing-bullet-green">
                          ▲
                        </span>
                        <span>{k}</span>
                      </li>
                    ))}
                  </ul>
                </Block>
              )}

              {objections.length > 0 && (
                <Block
                  label="Objections probables"
                  hint="Il piochera dans cette liste."
                >
                  <ul className="briefing-objections">
                    {objections.slice(0, 6).map((o, i) => (
                      <li key={i} className="briefing-objection-chip">
                        « {o} »
                      </li>
                    ))}
                    {objections.length > 6 && (
                      <li
                        className="briefing-objection-chip"
                        style={{ opacity: 0.55 }}
                      >
                        +{objections.length - 6} autres
                      </li>
                    )}
                  </ul>
                </Block>
              )}
            </div>
          </div>

          {/* COLONNE DROITE : OBJECTIF + RÉCOMPENSES + GO */}
          <div className="space-y-5">
            <div className="briefing-card briefing-card-objective">
              <div className="briefing-card-inner">
                <span className="briefing-eyebrow" style={{ color: "var(--color-green)" }}>
                  Objectif primaire
                </span>
                <p className="briefing-objective-text">
                  Décrocher un RDV avec{" "}
                  <strong style={{ color: "var(--color-green)" }}>
                    {personaName}
                  </strong>
                </p>
                <p
                  className="text-small mt-2"
                  style={{ color: "rgba(255,255,255,0.65)" }}
                >
                  Cold call B2B · 3 à 6 minutes max · {client?.name ?? ""}
                </p>
              </div>
            </div>

            <div className="briefing-card">
              <div className="briefing-card-inner">
                <span className="briefing-eyebrow" style={{ color: "#F7C041" }}>
                  Comportement de la cible
                </span>
                <p className="briefing-paragraph mt-2">
                  {difficultyConfig.description}
                </p>
                <div className="briefing-divider" />
                <p
                  className="text-small"
                  style={{ color: "rgba(255,255,255,0.7)" }}
                >
                  <strong style={{ color: "#FFFFFF" }}>Conditions de RDV : </strong>
                  {difficultyConfig.rdvCriteria}
                </p>
              </div>
            </div>

            <div className="briefing-card">
              <div className="briefing-card-inner">
                <span className="briefing-eyebrow" style={{ color: "#9d6bff" }}>
                  Récompenses possibles
                </span>
                <ul className="briefing-rewards">
                  <li>
                    <strong>+{rewardForDifficulty(difficulty)} XP</strong>
                    <span>Boucle l&apos;appel.</span>
                  </li>
                  <li>
                    <strong>+50 XP</strong>
                    <span>RDV décroché.</span>
                  </li>
                  <li>
                    <strong>+20 XP</strong>
                    <span>Score ≥ 90 (sans-faute).</span>
                  </li>
                </ul>
                <p
                  className="text-small mt-3"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                >
                  Des badges peuvent se débloquer selon ta performance.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAccept}
              disabled={starting}
              className="briefing-go-button briefing-go-pulse"
            >
              {countdown === null ? (
                <>ACCEPTER LA MISSION →</>
              ) : (
                <>
                  Connexion dans{" "}
                  <span key={countdown} className="briefing-tick">
                    {countdown}
                  </span>
                </>
              )}
            </button>
            <p
              className="text-meta text-center"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              Tu peux interrompre l&apos;appel à tout moment.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Block({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="briefing-block">
      <div className="briefing-block-head">
        <span className="briefing-block-label">{label}</span>
        {hint && <span className="briefing-block-hint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function DifficultyStars({ stars, color }: { stars: number; color: string }) {
  return (
    <span className="briefing-stars" style={{ color }}>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} style={{ opacity: i < stars ? 1 : 0.25 }}>
          ★
        </span>
      ))}
    </span>
  );
}

function DotPulse() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: "var(--color-green)",
        boxShadow: "0 0 0 0 rgba(60, 200, 121, 0.5)",
        animation: "login-dot-pulse 1.6s ease-out infinite",
      }}
      aria-hidden="true"
    />
  );
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (
    parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)
  ).toUpperCase();
}

function rewardForDifficulty(d: Difficulty): number {
  return d === "expert"
    ? 50
    : d === "avance"
      ? 25
      : d === "intermediaire"
        ? 10
        : 5;
}
