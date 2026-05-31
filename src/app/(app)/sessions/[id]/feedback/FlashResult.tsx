import Link from "next/link";
import {
  FLASH_BLOCKS,
  evaluateFlashCriteria,
  type FlashCriterion,
} from "@/lib/flash-blocks";
import type { DeltaCategory } from "@/lib/prospect-engine";
import type { BlockTarget, MessageRow, SessionRow } from "@/lib/supabase/types";
import { formatDuration } from "@/lib/format";

// Écran de résultat du drill flash : PASS/FAIL sur les 3 critères du bloc
// avec citation exacte du commercial là où le critère a été gagné (ou
// perdu), 1 phrase d'amélioration prioritaire, puis 3 cartes de relance
// pour enchaîner immédiatement un nouveau drill (refaire / autre famille
// / bloc suivant). Pas de score sur 100 ni de catégories : on reste dans
// la logique drill court → résultat lisible → on rejoue.

interface Props {
  session: SessionRow;
  messages: MessageRow[];
  block: BlockTarget;
}

const BLOCK_ACCENT: Record<BlockTarget, string> = {
  brise_glace: "#F4A261",
  decouverte: "#4A8FE7",
  pitch: "#9d6bff",
  objections: "#E25D6F",
  closing: "#3CC879",
};

const BLOCK_ORDER: BlockTarget[] = [
  "brise_glace",
  "decouverte",
  "pitch",
  "objections",
  "closing",
];

interface PerCriterionDetail {
  criterion: FlashCriterion;
  passed: boolean;
  count: number;
  citationQuote?: string;
}

function aggregateDeltas(messages: MessageRow[]): {
  positive: Partial<Record<DeltaCategory, number>>;
  negative: Partial<Record<DeltaCategory, number>>;
} {
  const positive: Partial<Record<DeltaCategory, number>> = {};
  const negative: Partial<Record<DeltaCategory, number>> = {};
  for (const m of messages) {
    if (m.role !== "prospect" || !m.metadata) continue;
    const meta = m.metadata as { delta?: "+" | "-"; delta_category?: DeltaCategory };
    if (!meta.delta || !meta.delta_category) continue;
    if (meta.delta === "+") {
      positive[meta.delta_category] = (positive[meta.delta_category] ?? 0) + 1;
    } else {
      negative[meta.delta_category] = (negative[meta.delta_category] ?? 0) + 1;
    }
  }
  return { positive, negative };
}

/** Cherche la 1ʳᵉ réplique commerciale qui a déclenché un delta sur la
 *  catégorie cible. On regarde, pour chaque message prospect porteur du
 *  delta, le message commercial qui PRÉCÈDE (puisque c'est celui qui a
 *  produit le geste évalué). On retourne le 1ᵉʳ trouvé pour avoir une
 *  citation représentative à montrer dans le résultat. */
function findCommercialQuoteFor(
  messages: MessageRow[],
  category: DeltaCategory,
  sign: "+" | "-",
): string | undefined {
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i]!;
    if (m.role !== "prospect" || !m.metadata) continue;
    const meta = m.metadata as { delta?: "+" | "-"; delta_category?: DeltaCategory };
    if (meta.delta !== sign || meta.delta_category !== category) continue;
    // Le message commercial à l'origine du delta est juste avant.
    for (let j = i - 1; j >= 0; j--) {
      const prev = messages[j]!;
      if (prev.role === "user") return prev.content;
      if (prev.role === "prospect") break;
    }
  }
  return undefined;
}

export function FlashResult({ session, messages, block }: Props) {
  const meta = FLASH_BLOCKS[block];
  const accent = BLOCK_ACCENT[block];
  const { positive, negative } = aggregateDeltas(messages);
  const evaluated = evaluateFlashCriteria(block, positive, negative);
  const validated = evaluated.filter((c) => c.passed).length;
  const allPass = validated === 3;
  const anyPass = validated >= 2;

  const details: PerCriterionDetail[] = evaluated.map((e) => {
    const sign = e.criterion.matcher.sign;
    // Pour un critère + on cite le moment OK ; pour un -, on cite le
    // moment où le critère est tombé (le négatif a été émis).
    if (sign === "+") {
      const quote = findCommercialQuoteFor(
        messages,
        e.criterion.matcher.category,
        "+",
      );
      return { ...e, citationQuote: quote };
    }
    if (e.count > 0) {
      const quote = findCommercialQuoteFor(
        messages,
        e.criterion.matcher.category,
        "-",
      );
      return { ...e, citationQuote: quote };
    }
    return { ...e };
  });

  // Phrase d'amélioration prioritaire : on prend le 1er critère raté.
  // Si tout est validé, message positif.
  const firstFail = details.find((d) => !d.passed);
  const improvementLine = firstFail
    ? buildImprovementLine(firstFail)
    : "Le drill est propre. Enchaîne sur le bloc suivant pour consolider.";

  // Cartes de relance
  const currentIdx = BLOCK_ORDER.indexOf(block);
  const nextBlock = BLOCK_ORDER[currentIdx + 1] ?? null;
  const refaireHref = `/sessions/new?mode=block&block=${block}`;
  const familleHref = `/sessions/new?mode=block&block=objections`;
  const suivantHref = nextBlock
    ? `/sessions/new?mode=block&block=${nextBlock}`
    : null;

  return (
    <div className="container-noxias py-10 space-y-9 max-w-3xl">
      {/* HERO */}
      <header>
        <Link
          href="/history"
          className="text-small inline-flex items-center gap-1 mb-6"
          style={{ color: "rgba(255, 255, 255, 0.65)" }}
        >
          ← Retour à l&apos;historique
        </Link>
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <span
            className="flash-tag"
            style={{
              background: `${accent}26`,
              color: accent,
              borderColor: `${accent}66`,
            }}
          >
            <span aria-hidden="true" className="flash-tag-dot" style={{ background: accent }} />
            DRILL FLASH · {meta.short_label.toUpperCase()}
          </span>
          <span className="text-meta" style={{ color: "rgba(255,255,255,0.55)" }}>
            Durée {formatDuration(session.started_at, session.ended_at)}
          </span>
        </div>
        <h1 className="text-h2">
          {allPass
            ? "3 critères validés. Drill réussi."
            : anyPass
              ? `${validated}/3 critères. Presque, mais pas net.`
              : `${validated}/3 critères. Reprends ce bloc.`}
        </h1>
        <p
          className="text-body mt-3"
          style={{ color: "rgba(255,255,255,0.75)" }}
        >
          {improvementLine}
        </p>
      </header>

      {/* 3 critères avec citation */}
      <section className="flash-result-criteria">
        {details.map((d) => (
          <CriterionResultCard key={d.criterion.id} detail={d} accent={accent} />
        ))}
      </section>

      {/* Mission rappel + cartes de relance */}
      <section className="space-y-4">
        <div>
          <div
            className="text-meta uppercase tracking-widest mb-2"
            style={{ color: accent, letterSpacing: "0.18em" }}
          >
            Et maintenant ?
          </div>
          <h2 className="text-h3">Enchaîne un autre drill.</h2>
          <p
            className="text-small mt-2"
            style={{ color: "rgba(255, 255, 255, 0.65)" }}
          >
            La répétition rapprochée, c&apos;est ce qui ancre le réflexe. 3
            à 5 drills consécutifs valent mieux qu&apos;1 simulation
            complète isolée.
          </p>
        </div>
        <div className="flash-result-relance">
          <RelanceCard
            href={refaireHref}
            accent={accent}
            label="↻ Refaire ce bloc"
            hint="Nouvelle amorce piochée"
          />
          {block === "objections" && (
            <RelanceCard
              href={familleHref}
              accent={accent}
              label="🎲 Autre famille"
              hint="12 objections au tirage"
            />
          )}
          {suivantHref && (
            <RelanceCard
              href={suivantHref}
              accent={BLOCK_ACCENT[nextBlock!]}
              label={`→ ${FLASH_BLOCKS[nextBlock!].short_label}`}
              hint="Bloc suivant du cold call"
            />
          )}
          <RelanceCard
            href="/sessions/new?mode=full"
            accent="rgba(255,255,255,0.5)"
            label="🎙️ Appel complet"
            hint="Tester en simulation longue"
            outline
          />
        </div>
      </section>

      {/* Lien transcript complet si besoin */}
      <details className="flash-result-transcript">
        <summary>Voir le transcript de ce drill</summary>
        <div className="flash-result-transcript-list">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flash-result-transcript-line flash-result-transcript-line-${m.role}`}
            >
              <span className="flash-result-transcript-role">
                {m.role === "user"
                  ? "Toi"
                  : m.role === "prospect"
                    ? "Prospect"
                    : "Système"}
              </span>
              <span>{m.content}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function CriterionResultCard({
  detail,
  accent,
}: {
  detail: PerCriterionDetail;
  accent: string;
}) {
  const isNeg = detail.criterion.matcher.sign === "-";
  const state: "ok" | "fail" = detail.passed ? "ok" : "fail";
  return (
    <div
      className={`flash-result-criterion flash-result-criterion-${state}`}
      style={state === "ok" ? { borderColor: `${accent}66` } : undefined}
    >
      <div className="flash-result-criterion-head">
        <span
          className={`flash-result-criterion-icon flash-result-criterion-icon-${state}`}
          aria-hidden="true"
        >
          {state === "ok" ? "✓" : "✗"}
        </span>
        <span className="flash-result-criterion-label">
          {detail.criterion.label}
        </span>
        {!isNeg && (
          <span className="flash-result-criterion-count">
            {detail.count} occurrence{detail.count > 1 ? "s" : ""}
          </span>
        )}
        {isNeg && detail.count > 0 && (
          <span className="flash-result-criterion-count flash-result-criterion-count-bad">
            {detail.count} fois enfreint
          </span>
        )}
      </div>
      {detail.citationQuote && (
        <blockquote
          className={`flash-result-criterion-quote flash-result-criterion-quote-${state}`}
        >
          « {detail.citationQuote} »
        </blockquote>
      )}
    </div>
  );
}

function RelanceCard({
  href,
  accent,
  label,
  hint,
  outline = false,
}: {
  href: string;
  accent: string;
  label: string;
  hint: string;
  outline?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flash-result-relance-card${outline ? " flash-result-relance-card-outline" : ""}`}
      style={
        outline
          ? { borderColor: "rgba(255,255,255,0.18)" }
          : {
              background: `linear-gradient(140deg, ${accent}22 0%, rgba(34, 25, 50, 0.55) 100%)`,
              borderColor: `${accent}66`,
            }
      }
    >
      <span className="flash-result-relance-label" style={{ color: outline ? "#FFFFFF" : accent }}>
        {label}
      </span>
      <span className="flash-result-relance-hint">{hint}</span>
    </Link>
  );
}

function buildImprovementLine(detail: PerCriterionDetail): string {
  const c = detail.criterion;
  if (c.matcher.sign === "+") {
    return `À retravailler en priorité : ${c.label.toLowerCase()}. C'est ce qui manque pour passer le drill.`;
  }
  return `À éviter la prochaine fois : ${c.label.toLowerCase()}. Ça t'a coûté le critère.`;
}
