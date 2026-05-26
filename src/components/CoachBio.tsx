import { CoachMascot } from "./CamilleMascot";

// Carte de présentation de Quentin Pasquier, le coach derrière CallLab.
// Sert à donner du contexte et de la crédibilité au coaching que l'outil
// distribue. Variant "compact" pour les pages internes, variant "full" pour
// le login et les pages de présentation.
//
// Tous les chiffres viennent de la prod Noxias et doivent rester cohérents
// avec ce qui est communiqué côté commercial.

export interface CoachCredentials {
  yearsCommercial: number;
  yearsManagement: number;
  callsAnalyzed: number;
}

export const QUENTIN_CREDENTIALS: CoachCredentials = {
  yearsCommercial: 10,
  yearsManagement: 7,
  callsAnalyzed: 10000,
};

const NUMBER_FR = new Intl.NumberFormat("fr-FR");

export function CoachBio({
  variant = "compact",
}: {
  variant?: "compact" | "full";
}) {
  if (variant === "full") {
    return (
      <div
        className="rounded-2xl p-6 sm:p-7"
        style={{
          background:
            "linear-gradient(140deg, rgba(157, 107, 255, 0.10) 0%, rgba(34, 25, 50, 0.6) 100%)",
          border: "1px solid rgba(157, 107, 255, 0.30)",
          backdropFilter: "blur(16px) saturate(160%)",
        }}
      >
        <div className="flex items-center gap-5 flex-wrap">
          <CoachMascot state="happy" size={88} withHalo />
          <div className="flex-1 min-w-[220px]">
            <span
              className="text-meta uppercase"
              style={{
                color: "var(--color-green)",
                letterSpacing: "0.18em",
                fontWeight: 700,
              }}
            >
              Ton coach
            </span>
            <h3
              className="text-h3 mt-1"
              style={{ color: "#FFFFFF", lineHeight: 1.15 }}
            >
              Quentin Pasquier
            </h3>
            <p
              className="text-small mt-2"
              style={{ color: "rgba(255, 255, 255, 0.75)" }}
            >
              Fondateur de <strong>Noxias</strong>, agence et équipe commerciale
              externalisée. {QUENTIN_CREDENTIALS.yearsCommercial} ans de
              terrain commercial, {QUENTIN_CREDENTIALS.yearsManagement} ans de
              management.
            </p>
          </div>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          <CredentialChip
            value={`${QUENTIN_CREDENTIALS.yearsCommercial} ans`}
            label="Terrain commercial"
          />
          <CredentialChip
            value={`${QUENTIN_CREDENTIALS.yearsManagement} ans`}
            label="Management commercial"
          />
          <CredentialChip
            value={`${NUMBER_FR.format(QUENTIN_CREDENTIALS.callsAnalyzed)}+`}
            label="Calls analysés"
          />
        </ul>
        <p
          className="text-small mt-5"
          style={{ color: "rgba(255, 255, 255, 0.65)", lineHeight: 1.5 }}
        >
          CallLab est branché sur la prod Noxias. Ce que tu travailles ici
          est exactement ce qui marche en vrai, calibré avec ce qu'on observe
          sur des milliers d'appels en production.
        </p>
      </div>
    );
  }

  // variant compact
  return (
    <div
      className="rounded-xl p-4 flex items-center gap-4"
      style={{
        background: "rgba(157, 107, 255, 0.08)",
        border: "1px solid rgba(157, 107, 255, 0.25)",
      }}
    >
      <CoachMascot state="idle" size={56} />
      <div className="min-w-0 flex-1">
        <p style={{ color: "#FFFFFF", fontWeight: 700, fontSize: "0.9rem" }}>
          Quentin Pasquier · Ton coach
        </p>
        <p
          className="text-meta mt-0.5"
          style={{ color: "rgba(255, 255, 255, 0.7)" }}
        >
          {QUENTIN_CREDENTIALS.yearsCommercial} ans de commercial ·{" "}
          {QUENTIN_CREDENTIALS.yearsManagement} ans de management ·{" "}
          {NUMBER_FR.format(QUENTIN_CREDENTIALS.callsAnalyzed)}+ calls analysés
        </p>
      </div>
    </div>
  );
}

function CredentialChip({ value, label }: { value: string; label: string }) {
  return (
    <li
      className="rounded-lg p-3"
      style={{
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      <div
        style={{
          color: "var(--color-green)",
          fontFamily: "var(--font-ubuntu), Lato, sans-serif",
          fontSize: "1.4rem",
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        className="text-meta mt-1"
        style={{
          color: "rgba(255, 255, 255, 0.6)",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
    </li>
  );
}
