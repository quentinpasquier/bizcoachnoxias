"use client";

import { useState, type ReactNode } from "react";
import { CoachMascot } from "./CamilleMascot";

// Bulle "Le conseil du coach" : Quentin glisse une consigne / un avis dans
// l'écran à un moment clé (config d'offre, choix de session, débrief…).
// Sert à donner de la valeur ajoutée pédagogique en plus de l'UI brute.
//
// 3 variants :
//   - inline  : carte plate, intégrée dans le flux (par défaut)
//   - banner  : bandeau pleine largeur, mise en avant en haut d'écran
//   - compact : ligne unique, pour les zones serrées
//
// Le titre par défaut est "Le conseil du coach". Le ton est direct,
// dirigeant à dirigeant, pas de jargon corporate.

interface CoachTipProps {
  children: ReactNode;
  title?: string;
  variant?: "inline" | "banner" | "compact";
  collapsible?: boolean;
  defaultOpen?: boolean;
  accent?: "violet" | "green";
}

export function CoachTip({
  children,
  title = "Le conseil du coach",
  variant = "inline",
  collapsible = false,
  defaultOpen = true,
  accent = "violet",
}: CoachTipProps) {
  const [open, setOpen] = useState(defaultOpen);
  const palette =
    accent === "green"
      ? {
          bg: "rgba(60, 200, 121, 0.10)",
          border: "rgba(60, 200, 121, 0.32)",
          eyebrow: "var(--color-green)",
        }
      : {
          bg: "rgba(157, 107, 255, 0.10)",
          border: "rgba(157, 107, 255, 0.30)",
          eyebrow: "#b495ff",
        };

  if (variant === "compact") {
    return (
      <div
        className="rounded-lg px-3 py-2 flex items-start gap-3"
        style={{
          background: palette.bg,
          border: `1px solid ${palette.border}`,
        }}
      >
        <CoachMascot state="idle" size={32} />
        <p
          className="text-meta"
          style={{ color: "rgba(255, 255, 255, 0.85)", lineHeight: 1.45 }}
        >
          <strong style={{ color: palette.eyebrow }}>Quentin :</strong>{" "}
          {children}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl ${variant === "banner" ? "p-5" : "p-4"}`}
      style={{
        background: palette.bg,
        border: `1px solid ${palette.border}`,
      }}
    >
      <div className="flex items-start gap-3">
        <CoachMascot state="idle" size={48} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <span
              className="text-meta uppercase"
              style={{
                color: palette.eyebrow,
                letterSpacing: "0.18em",
                fontWeight: 700,
              }}
            >
              {title}
            </span>
            {collapsible && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="text-meta"
                style={{
                  color: "rgba(255, 255, 255, 0.55)",
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                }}
              >
                {open ? "Masquer" : "Voir le conseil"}
              </button>
            )}
          </div>
          {open && (
            <div
              className="text-small mt-1.5"
              style={{
                color: "rgba(255, 255, 255, 0.85)",
                lineHeight: 1.5,
              }}
            >
              {children}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
