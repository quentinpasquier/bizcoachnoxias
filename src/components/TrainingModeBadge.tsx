import type { BlockTarget, TrainingMode } from "@/lib/supabase/types";

// Mini-badge visible sur les lignes de sessions de l'historique pour
// identifier en un coup d'œil le mode d'entraînement de chaque session.
// 3 variantes colorées cohérentes avec le thème du tunnel :
//   - Coaching ciblé    → vert  (avec le nom du bloc en infos)
//   - Coaching embarqué → orange (avec nb de reformulations en infos)
//   - Appel complet     → violet (sans info contextuelle)
//
// Variante `compact` : juste l'icône, pour les zones très denses.

const BLOCK_LABELS: Record<BlockTarget, string> = {
  brise_glace: "Brise-glace",
  decouverte: "Découverte",
  pitch: "Pitch",
  objections: "Objections",
  closing: "Closing",
};

interface Props {
  mode: TrainingMode;
  blockTarget?: BlockTarget | null;
  embeddedBlocksCount?: number | null;
  compact?: boolean;
}

export function TrainingModeBadge({
  mode,
  blockTarget,
  embeddedBlocksCount,
  compact = false,
}: Props) {
  const meta = META[mode];
  const label = compact ? null : meta.label;

  // Info contextuelle selon le mode (uniquement en variante non compact)
  let extra: string | null = null;
  if (!compact) {
    if (mode === "block" && blockTarget) {
      extra = BLOCK_LABELS[blockTarget] ?? null;
    } else if (mode === "embedded" && typeof embeddedBlocksCount === "number") {
      extra =
        embeddedBlocksCount === 0
          ? "Aucun blocage"
          : `${embeddedBlocksCount} reformulation${embeddedBlocksCount > 1 ? "s" : ""}`;
    }
  }

  return (
    <span
      className={`training-mode-badge training-mode-badge-${mode} ${
        compact ? "training-mode-badge-compact" : ""
      }`}
      title={compact ? meta.label : undefined}
    >
      <span className="training-mode-badge-icon" aria-hidden="true">
        {meta.icon}
      </span>
      {label && <span className="training-mode-badge-label">{label}</span>}
      {extra && <span className="training-mode-badge-extra">· {extra}</span>}
    </span>
  );
}

const META: Record<TrainingMode, { icon: string; label: string }> = {
  block: { icon: "🎯", label: "Ciblé" },
  embedded: { icon: "🧑‍🏫", label: "Embarqué" },
  full: { icon: "📞", label: "Complet" },
};
