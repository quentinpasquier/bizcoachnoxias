import type { SessionRow } from "./supabase/types";

// =============================================================================
// Système de RANGS Bizcoach : 6 tiers × 4 niveaux = 24 rangs.
// Basé sur des Practis Points (PPN) qui peuvent MONTER ou DESCENDRE.
//
// Une bonne perf augmente les PPN. Une mauvaise les fait descendre.
// Le rang affiché correspond aux PPN cumulés (clampés à 0 minimum).
// Chaque rang donne droit à une récompense mensuelle (1€ à 30€).
// =============================================================================

export type RankTier =
  | "bronze"
  | "argent"
  | "gold"
  | "platine"
  | "diamant"
  | "master";

export interface RankTierConfig {
  tier: RankTier;
  label: string;
  thresholds: [number, number, number, number];
  primary: string;
  secondary: string;
  glow: string;
  badgeShape: "shield" | "star" | "crown";
}

export const RANK_TIERS: RankTierConfig[] = [
  {
    tier: "bronze",
    label: "Bronze",
    thresholds: [0, 150, 300, 500],
    primary: "#C28859",
    secondary: "#8E5A2B",
    glow: "rgba(194, 136, 89, 0.40)",
    badgeShape: "shield",
  },
  {
    tier: "argent",
    label: "Argent",
    thresholds: [750, 1000, 1300, 1650],
    primary: "#D6D6E0",
    secondary: "#9A9AAA",
    glow: "rgba(214, 214, 224, 0.45)",
    badgeShape: "shield",
  },
  {
    tier: "gold",
    label: "Gold",
    thresholds: [2050, 2500, 3000, 3550],
    primary: "#F7C041",
    secondary: "#E59A1B",
    glow: "rgba(247, 192, 65, 0.45)",
    badgeShape: "shield",
  },
  {
    tier: "platine",
    label: "Platine",
    thresholds: [4150, 4800, 5500, 6250],
    primary: "#7DD3FC",
    secondary: "#0284C7",
    glow: "rgba(125, 211, 252, 0.45)",
    badgeShape: "star",
  },
  {
    tier: "diamant",
    label: "Diamant",
    thresholds: [7050, 7900, 8800, 9750],
    primary: "#9d6bff",
    secondary: "#5b2bb6",
    glow: "rgba(157, 107, 255, 0.5)",
    badgeShape: "star",
  },
  {
    tier: "master",
    label: "Master",
    thresholds: [10750, 11800, 12900, 14050],
    primary: "#3CC879",
    secondary: "#1F8A4F",
    glow: "rgba(60, 200, 121, 0.55)",
    badgeShape: "crown",
  },
];

// Récompense mensuelle par rang global (1 → 24) : 1€ à 30€.
// Progression : Bronze 1-4€, Argent 5-11€, Gold 12-18€,
// Platine 19-23€, Diamant 24-28€, Master 29-30€.
export const MONTHLY_REWARDS_EUR: number[] = [
  1, 2, 3, 4, // Bronze I-IV
  5, 7, 9, 11, // Argent I-IV
  12, 14, 16, 18, // Gold I-IV
  19, 20, 22, 23, // Platine I-IV
  24, 25, 26, 28, // Diamant I-IV
  29, 30, 30, 30, // Master I-IV (cap à 30€)
];

export interface RankInfo {
  tier: RankTier;
  tierLabel: string;
  subLevel: 1 | 2 | 3 | 4;
  label: string;
  ppn: number;
  ppnForCurrent: number;
  ppnForNext: number | null;
  progressPct: number;
  primary: string;
  secondary: string;
  glow: string;
  badgeShape: "shield" | "star" | "crown";
  globalIndex: number;
  monthlyRewardEur: number;
}

const FLAT_THRESHOLDS = RANK_TIERS.flatMap((t, ti) =>
  t.thresholds.map((ppn, li) => ({
    ppn,
    tier: t.tier,
    tierLabel: t.label,
    subLevel: (li + 1) as 1 | 2 | 3 | 4,
    primary: t.primary,
    secondary: t.secondary,
    glow: t.glow,
    badgeShape: t.badgeShape,
    globalIndex: ti * 4 + li + 1,
  })),
);

const ROMAN = ["", "I", "II", "III", "IV"];

export function rankFromPpn(ppn: number): RankInfo {
  const clamped = Math.max(0, ppn);
  let current = FLAT_THRESHOLDS[0]!;
  for (const t of FLAT_THRESHOLDS) {
    if (clamped >= t.ppn) current = t;
    else break;
  }
  const idx = FLAT_THRESHOLDS.indexOf(current);
  const next =
    idx < FLAT_THRESHOLDS.length - 1 ? FLAT_THRESHOLDS[idx + 1]! : null;

  const ppnForCurrent = current.ppn;
  const ppnForNext = next?.ppn ?? null;
  const span = ppnForNext !== null ? ppnForNext - ppnForCurrent : 1;
  const progressPct =
    ppnForNext !== null
      ? Math.min(100, Math.round(((clamped - ppnForCurrent) / span) * 100))
      : 100;

  return {
    tier: current.tier,
    tierLabel: current.tierLabel,
    subLevel: current.subLevel,
    label: `${current.tierLabel} ${ROMAN[current.subLevel]}`,
    ppn: clamped,
    ppnForCurrent,
    ppnForNext,
    progressPct,
    primary: current.primary,
    secondary: current.secondary,
    glow: current.glow,
    badgeShape: current.badgeShape,
    globalIndex: current.globalIndex,
    monthlyRewardEur: MONTHLY_REWARDS_EUR[current.globalIndex - 1] ?? 1,
  };
}

// =============================================================================
// Calcul des PPN par session.
// =============================================================================

export interface PpnBreakdown {
  outcome: number;
  score: number;
  difficultyMult: number;
  total: number;
}

export function ppnForSession(s: SessionRow): PpnBreakdown {
  if (s.status !== "completed") {
    return { outcome: 0, score: 0, difficultyMult: 1, total: 0 };
  }

  let outcome = 0;
  if (s.appointment_secured) outcome += 30;
  else if (s.ended_by === "prospect") outcome -= 10;
  else if (s.ended_by === "user") outcome += 0;
  else outcome -= 5;

  const score = s.score ?? 0;
  let scorePts = 0;
  if (score >= 90) scorePts = 20;
  else if (score >= 75) scorePts = 10;
  else if (score >= 50) scorePts = 0;
  else if (score >= 30) scorePts = -5;
  else scorePts = -15;

  const mult =
    s.difficulty === "expert"
      ? 1.7
      : s.difficulty === "avance"
        ? 1.3
        : s.difficulty === "intermediaire"
          ? 1.0
          : 0.8;

  const raw = (outcome + scorePts) * mult;
  return {
    outcome,
    score: scorePts,
    difficultyMult: mult,
    total: Math.round(raw),
  };
}

export function totalPpn(sessions: SessionRow[]): number {
  return sessions.reduce((acc, s) => acc + ppnForSession(s).total, 0);
}

export interface RankProgress extends RankInfo {
  ppnInLevel: number;
  ppnToNext: number | null;
}

export function rankProgress(ppn: number): RankProgress {
  const info = rankFromPpn(ppn);
  const ppnInLevel = info.ppn - info.ppnForCurrent;
  const ppnToNext =
    info.ppnForNext !== null ? info.ppnForNext - info.ppn : null;
  return { ...info, ppnInLevel, ppnToNext };
}
