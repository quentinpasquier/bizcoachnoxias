import type { SessionRow } from "./supabase/types";

// =============================================================================
// Système de RANGS Bizcoach : 6 tiers × 4 niveaux = 24 rangs.
// Basé sur des Rank Points (RP) qui peuvent MONTER ou DESCENDRE.
//
// Une bonne perf augmente les RP. Une mauvaise les fait descendre.
// Le rang affiché correspond aux RP cumulés (clampés à 0 minimum).
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
  // 4 niveaux par tier, RP cumulés requis pour atteindre chaque niveau
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

export interface RankInfo {
  tier: RankTier;
  tierLabel: string;
  subLevel: 1 | 2 | 3 | 4; // niveau dans le tier (I, II, III, IV)
  label: string; // ex: "Gold III"
  rp: number;
  rpForCurrent: number; // RP requis pour atteindre ce sous-niveau
  rpForNext: number | null; // RP requis pour le prochain (null si Master IV)
  progressPct: number; // 0-100 dans le sous-niveau
  primary: string;
  secondary: string;
  glow: string;
  badgeShape: "shield" | "star" | "crown";
  globalIndex: number; // 1-24
}

// Tous les seuils dans l'ordre, avec leur (tier, subLevel, globalIndex)
const FLAT_THRESHOLDS = RANK_TIERS.flatMap((t, ti) =>
  t.thresholds.map((rp, li) => ({
    rp,
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

export function rankFromRp(rp: number): RankInfo {
  const clamped = Math.max(0, rp);
  let current = FLAT_THRESHOLDS[0]!;
  for (const t of FLAT_THRESHOLDS) {
    if (clamped >= t.rp) current = t;
    else break;
  }
  const idx = FLAT_THRESHOLDS.indexOf(current);
  const next =
    idx < FLAT_THRESHOLDS.length - 1 ? FLAT_THRESHOLDS[idx + 1]! : null;

  const rpForCurrent = current.rp;
  const rpForNext = next?.rp ?? null;
  const span = rpForNext !== null ? rpForNext - rpForCurrent : 1;
  const progressPct =
    rpForNext !== null
      ? Math.min(100, Math.round(((clamped - rpForCurrent) / span) * 100))
      : 100;

  return {
    tier: current.tier,
    tierLabel: current.tierLabel,
    subLevel: current.subLevel,
    label: `${current.tierLabel} ${ROMAN[current.subLevel]}`,
    rp: clamped,
    rpForCurrent,
    rpForNext,
    progressPct,
    primary: current.primary,
    secondary: current.secondary,
    glow: current.glow,
    badgeShape: current.badgeShape,
    globalIndex: current.globalIndex,
  };
}

// =============================================================================
// Calcul des Rank Points par session.
// Une session peut RAPPORTER des RP ou en FAIRE PERDRE.
// =============================================================================

export interface RpBreakdown {
  outcome: number; // points de l'issue (RDV / raccrochage)
  score: number; // points du score 20 critères
  difficultyMult: number; // multiplicateur de difficulté
  total: number; // total final pour cette session
}

export function rpForSession(s: SessionRow): RpBreakdown {
  if (s.status !== "completed") {
    return { outcome: 0, score: 0, difficultyMult: 1, total: 0 };
  }

  // Outcome
  let outcome = 0;
  if (s.appointment_secured) outcome += 30;
  else if (s.ended_by === "prospect") outcome -= 10;
  else if (s.ended_by === "user") outcome += 0;
  else outcome -= 5;

  // Score sur 20 critères
  const score = s.score ?? 0;
  let scorePts = 0;
  if (score >= 90) scorePts = 20;
  else if (score >= 75) scorePts = 10;
  else if (score >= 50) scorePts = 0;
  else if (score >= 30) scorePts = -5;
  else scorePts = -15;

  // Multiplicateur de difficulté
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

export function totalRp(sessions: SessionRow[]): number {
  return sessions.reduce((acc, s) => acc + rpForSession(s).total, 0);
}

export interface RankProgress extends RankInfo {
  rpInLevel: number; // RP au-dessus du seuil actuel
  rpToNext: number | null; // RP restants avant prochain niveau
}

export function rankProgress(rp: number): RankProgress {
  const info = rankFromRp(rp);
  const rpInLevel = info.rp - info.rpForCurrent;
  const rpToNext = info.rpForNext !== null ? info.rpForNext - info.rp : null;
  return { ...info, rpInLevel, rpToNext };
}
