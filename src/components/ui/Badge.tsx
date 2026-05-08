import type { ReactNode } from "react";
import type { Difficulty } from "@/lib/supabase/types";

type Tone = "neutral" | "success" | "error" | "warning" | "info" | "purple";

interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
}

const toneStyles: Record<Tone, { bg: string; color: string }> = {
  neutral: { bg: "rgba(139, 127, 163, 0.16)", color: "var(--color-purple)" },
  success: { bg: "rgba(60, 200, 121, 0.18)", color: "#1F6A3F" },
  error: { bg: "rgba(233, 75, 75, 0.16)", color: "#A61F1F" },
  warning: { bg: "rgba(245, 165, 36, 0.18)", color: "#8A5A0E" },
  info: { bg: "rgba(74, 143, 231, 0.18)", color: "#1F4A88" },
  purple: { bg: "var(--color-purple)", color: "#FFFFFF" },
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  const s = toneStyles[tone];
  return (
    <span className="badge" style={{ background: s.bg, color: s.color }}>
      {children}
    </span>
  );
}

const DIFFICULTY_TONE: Record<Difficulty, Tone> = {
  debutant: "success",
  intermediaire: "info",
  avance: "warning",
  expert: "error",
};

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
  expert: "Expert",
};

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <Badge tone={DIFFICULTY_TONE[difficulty]}>
      {DIFFICULTY_LABEL[difficulty]}
    </Badge>
  );
}

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return <Badge tone="neutral">—</Badge>;
  }
  const tone: Tone =
    score >= 75 ? "success" : score >= 50 ? "info" : score >= 30 ? "warning" : "error";
  return <Badge tone={tone}>{score}/100</Badge>;
}
