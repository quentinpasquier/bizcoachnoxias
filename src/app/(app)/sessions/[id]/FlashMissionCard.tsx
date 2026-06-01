"use client";

import { useEffect, useState } from "react";
import { FLASH_BLOCKS, evaluateFlashCriteria } from "@/lib/flash-blocks";
import type { DeltaCategory } from "@/lib/prospect-engine";
import type { BlockTarget } from "@/lib/supabase/types";

// Carte sticky affichée en haut de la ChatRoom uniquement en mode drill
// flash. 3 zones très denses : (1) l'amorce épinglée en chip discret pour
// rappeler d'où on part, (2) le timer avec zones colorées (vert 2-4 min,
// jaune 4-6, rouge >6) — pas un compte-rebours anxiogène, juste un repère
// visuel de pacing, (3) la checklist des 3 critères qui tickent quand
// l'évaluateur online émet le delta correspondant.

interface Props {
  block: BlockTarget;
  opener: string | null;
  /** Compteurs cumulés des deltas positifs émis depuis le début de l'appel. */
  positiveCounts: Partial<Record<DeltaCategory, number>>;
  /** Idem pour les deltas négatifs (un négatif au-delà du seuil rouge un
   *  critère "garde-fou"). */
  negativeCounts: Partial<Record<DeltaCategory, number>>;
  /** Timestamp ms du début de l'appel (1ʳᵉ réplique commercial envoyée). */
  startedAt: number | null;
}

const BLOCK_ACCENT: Record<BlockTarget, string> = {
  brise_glace: "#F4A261",
  decouverte: "#4A8FE7",
  pitch: "#9d6bff",
  objections: "#E25D6F",
  closing: "#3CC879",
};

export function FlashMissionCard({
  block,
  opener,
  positiveCounts,
  negativeCounts,
  startedAt,
}: Props) {
  const meta = FLASH_BLOCKS[block];
  const accent = BLOCK_ACCENT[block];
  const evaluated = evaluateFlashCriteria(
    block,
    positiveCounts,
    negativeCounts,
  );
  const validated = evaluated.filter((c) => c.passed).length;

  // Timer ré-render toutes les 500ms (suffisant pour une barre fluide,
  // sans coût notable). On part du startedAt fourni par le parent
  // (1ʳᵉ réplique commerciale, pas le mount, pour ne pas pénaliser le
  // temps de lecture de la fiche briefing).
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [startedAt]);

  const elapsedSec = startedAt ? Math.max(0, (now - startedAt) / 1000) : 0;
  const mm = Math.floor(elapsedSec / 60);
  const ss = Math.floor(elapsedSec % 60);
  const timeLabel = `${mm}:${ss.toString().padStart(2, "0")}`;

  // Bornes des zones (en secondes) : cible 2-4 min vert, tolérance 4-6 min
  // jaune, dépassement >6 min rouge. Barre full = 6 min (la zone rouge se
  // remplit visuellement de la même manière mais la barre reste à 100%).
  const TARGET_START = 120;
  const TARGET_END = 240;
  const TOLERATE_END = 360;
  const progressPct = Math.min(100, (elapsedSec / TOLERATE_END) * 100);
  const timerZone: "early" | "target" | "warn" | "over" =
    elapsedSec < TARGET_START
      ? "early"
      : elapsedSec < TARGET_END
        ? "target"
        : elapsedSec < TOLERATE_END
          ? "warn"
          : "over";
  const timerColor =
    timerZone === "target"
      ? "var(--color-green)"
      : timerZone === "warn"
        ? "var(--color-warning)"
        : timerZone === "over"
          ? "var(--color-red)"
          : "rgba(255, 255, 255, 0.4)";

  return (
    <div
      className="flash-mission-card"
      style={{ borderColor: `${accent}55` }}
    >
      <div className="flash-mission-head">
        <div className="flash-mission-head-left">
          <span
            className="flash-mission-tag"
            style={{ background: `${accent}26`, color: accent }}
          >
            DRILL · {meta.short_label.toUpperCase()}
          </span>
          <span className="flash-mission-objective">{meta.mission}</span>
        </div>
        <div className="flash-mission-head-right">
          <div className="flash-mission-score" style={{ color: accent }}>
            <span className="flash-mission-score-num">{validated}</span>
            <span className="flash-mission-score-denom">/3</span>
          </div>
          <span className="flash-mission-score-label">critères</span>
        </div>
      </div>

      {opener && (
        <div className="flash-mission-opener">
          <span className="flash-mission-opener-label">Tu pars de :</span>
          <span className="flash-mission-opener-text">« {opener} »</span>
        </div>
      )}

      <div className="flash-mission-timer">
        <div className="flash-mission-timer-head">
          <span className="flash-mission-timer-label">
            Cible 3 à 5 min · drill flash
          </span>
          <span
            className="flash-mission-timer-value"
            style={{ color: timerColor }}
          >
            {startedAt ? timeLabel : "—:—"}
          </span>
        </div>
        <div className="flash-mission-timer-bar">
          {/* Zones repère (target, tolerate, over) */}
          <span
            className="flash-mission-timer-zone flash-mission-timer-zone-target"
            style={{
              left: `${(TARGET_START / TOLERATE_END) * 100}%`,
              width: `${((TARGET_END - TARGET_START) / TOLERATE_END) * 100}%`,
            }}
          />
          <span
            className="flash-mission-timer-zone flash-mission-timer-zone-warn"
            style={{
              left: `${(TARGET_END / TOLERATE_END) * 100}%`,
              width: `${((TOLERATE_END - TARGET_END) / TOLERATE_END) * 100}%`,
            }}
          />
          <span
            className="flash-mission-timer-fill"
            style={{ width: `${progressPct}%`, background: timerColor }}
          />
        </div>
      </div>

      <ul className="flash-mission-criteria">
        {evaluated.map(({ criterion, passed, count }) => {
          const isNegative = criterion.matcher.sign === "-";
          // Pour les "+" : passé une fois validé, accentué.
          // Pour les "-" : par défaut "encore en règle" (icône check),
          // devient "fail" si count > 0. Visuel rouge dès qu'enfreint.
          const state: "pending" | "ok" | "fail" =
            isNegative
              ? count > 0
                ? "fail"
                : "ok"
              : passed
                ? "ok"
                : "pending";
          return (
            <li
              key={criterion.id}
              className={`flash-mission-criterion flash-mission-criterion-${state}`}
            >
              <span className="flash-mission-criterion-icon" aria-hidden="true">
                {state === "ok" ? "✓" : state === "fail" ? "✗" : "○"}
              </span>
              <span className="flash-mission-criterion-text">
                {criterion.short}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
