"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TrainingStepper } from "@/components/TrainingStepper";
import { FLASH_BLOCKS, type FlashCriterion } from "@/lib/flash-blocks";
import type { BlockTarget, SessionRow } from "@/lib/supabase/types";

// Fiche flash pour le mode "Coaching ciblé" / drill flash. Tient en 1 écran
// sans scroll (idéalement) : contexte 2 lignes, mission unique, 3 critères
// de réussite, phrase d'amorce épinglée, CTA "Lancer le flash". Aucune
// densité d'information "persona riche" comme dans le briefing classique —
// le but est de lancer l'enchaînement de drills, pas de plonger dans une
// simulation immersive.

interface Props {
  sessionId: string;
  session: SessionRow;
}

const BLOCK_ACCENT: Record<BlockTarget, string> = {
  brise_glace: "#F4A261",
  decouverte: "#4A8FE7",
  pitch: "#9d6bff",
  objections: "#E25D6F",
  closing: "#3CC879",
};

export function FlashBriefing({ sessionId, session }: Props) {
  const router = useRouter();
  const [countdown, setCountdown] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);

  const blockTarget = session.block_target as BlockTarget;
  const meta = FLASH_BLOCKS[blockTarget];
  const accent = BLOCK_ACCENT[blockTarget];
  const opener = session.scenario_data?.flash_meta?.opener_text ?? "";
  const personaName =
    session.scenario_data?.persona_name ?? session.persona_label ?? "Cible";
  const personaRole = session.scenario_data?.persona_role ?? "";
  const company = session.scenario_data?.company_name ?? "";

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      router.push(`/sessions/${sessionId}`);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c ?? 0) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, router, sessionId]);

  function handleAccept() {
    setStarting(true);
    setCountdown(3);
  }

  return (
    <div className="relative">
      <div className="briefing-blob briefing-blob-1" aria-hidden="true" />
      <div className="briefing-blob briefing-blob-2" aria-hidden="true" />

      <div className="container-noxias relative z-10 py-8 lg:py-10 space-y-7 max-w-3xl">
        <TrainingStepper
          currentStep="briefing"
          trainingMode={session.training_mode ?? "block"}
        />

        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className="flash-tag"
              style={{ background: `${accent}26`, color: accent, borderColor: `${accent}66` }}
            >
              <span aria-hidden="true" className="flash-tag-dot" style={{ background: accent }} />
              DRILL FLASH · {meta.short_label.toUpperCase()}
            </span>
            <span
              className="text-meta"
              style={{ color: "rgba(255,255,255,0.45)" }}
            >
              3 à 5 min
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

        <div className="flash-briefing-card" style={{ borderColor: `${accent}55` }}>
          {/* Zone 1 : Contexte ultra-bref */}
          <div className="flash-briefing-context">
            <div className="flash-briefing-eyebrow" style={{ color: accent }}>
              Contexte
            </div>
            <p className="flash-briefing-context-line">
              {meta.context_line}
            </p>
            <p className="flash-briefing-target">
              En face : <strong>{personaName}</strong>
              {personaRole ? `, ${personaRole}` : ""}
              {company ? ` chez ${company}` : ""}.
            </p>
          </div>

          <div className="flash-briefing-divider" />

          {/* Zone 2 : Mission unique */}
          <div className="flash-briefing-mission">
            <div className="flash-briefing-eyebrow" style={{ color: accent }}>
              Ta mission
            </div>
            <p className="flash-briefing-mission-text">{meta.mission}</p>
          </div>

          <div className="flash-briefing-divider" />

          {/* Zone 3 : 3 critères de réussite */}
          <div className="flash-briefing-criteria">
            <div className="flash-briefing-eyebrow" style={{ color: accent }}>
              3 critères de réussite
            </div>
            <ul className="flash-briefing-criteria-list">
              {meta.criteria.map((c) => (
                <CriterionRow key={c.id} criterion={c} accent={accent} />
              ))}
            </ul>
          </div>

          <div className="flash-briefing-divider" />

          {/* Zone 4 : Phrase d'amorce épinglée */}
          {opener && (
            <div className="flash-briefing-opener">
              <div className="flash-briefing-eyebrow" style={{ color: accent }}>
                Tu pars de
              </div>
              <blockquote className="flash-briefing-opener-quote">
                « {opener} »
              </blockquote>
              <p className="flash-briefing-opener-hint">
                Le prospect ouvre exactement par cette phrase. À toi de jouer
                tout de suite à partir de là.
              </p>
            </div>
          )}
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={handleAccept}
          disabled={starting}
          className="flash-briefing-cta"
          style={{
            background: accent,
            boxShadow: `0 12px 32px ${accent}55`,
          }}
        >
          {countdown === null ? (
            <>LANCER LE FLASH · 3-5 min →</>
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
          Tu peux raccrocher à tout moment pour passer au drill suivant.
        </p>
      </div>
    </div>
  );
}

function CriterionRow({
  criterion,
  accent,
}: {
  criterion: FlashCriterion;
  accent: string;
}) {
  const isNegative = criterion.matcher.sign === "-";
  return (
    <li className="flash-briefing-criterion">
      <span
        className="flash-briefing-criterion-bullet"
        style={{
          background: isNegative
            ? "rgba(233, 75, 75, 0.14)"
            : `${accent}22`,
          color: isNegative ? "#FFB4B4" : accent,
          borderColor: isNegative
            ? "rgba(233, 75, 75, 0.45)"
            : `${accent}66`,
        }}
        aria-hidden="true"
      >
        {isNegative ? "✗" : "✓"}
      </span>
      <span className="flash-briefing-criterion-label">{criterion.label}</span>
    </li>
  );
}
