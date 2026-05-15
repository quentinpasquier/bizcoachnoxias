import type { SessionRow } from "./supabase/types";

// =============================================================================
// Système XP, niveaux et rangs.
// Calculé à la volée depuis les sessions terminées : pas de table dédiée,
// la source de vérité reste sessions + quiz_attempts.
// =============================================================================

export type RankTier =
  | "bronze"
  | "argent"
  | "or"
  | "platine"
  | "diamant"
  | "legende";

export interface RankConfig {
  tier: RankTier;
  label: string;
  minLevel: number;
  // Couleurs : pour halo/médaille
  primary: string;
  secondary: string;
  glow: string;
}

export const RANKS: RankConfig[] = [
  {
    tier: "bronze",
    label: "Bronze",
    minLevel: 1,
    primary: "#C28859",
    secondary: "#8E5A2B",
    glow: "rgba(194, 136, 89, 0.35)",
  },
  {
    tier: "argent",
    label: "Argent",
    minLevel: 5,
    primary: "#D6D6E0",
    secondary: "#9A9AAA",
    glow: "rgba(214, 214, 224, 0.45)",
  },
  {
    tier: "or",
    label: "Or",
    minLevel: 12,
    primary: "#F7C041",
    secondary: "#E59A1B",
    glow: "rgba(247, 192, 65, 0.45)",
  },
  {
    tier: "platine",
    label: "Platine",
    minLevel: 22,
    primary: "#9d6bff",
    secondary: "#6b3fb6",
    glow: "rgba(157, 107, 255, 0.45)",
  },
  {
    tier: "diamant",
    label: "Diamant",
    minLevel: 35,
    primary: "#3CC879",
    secondary: "#1F8A4F",
    glow: "rgba(60, 200, 121, 0.5)",
  },
  {
    tier: "legende",
    label: "Légende",
    minLevel: 55,
    primary: "#E94B4B",
    secondary: "#A61F1F",
    glow: "rgba(233, 75, 75, 0.5)",
  },
];

// XP par session terminée :
// - Le score de l'évaluateur (0-100)
// - Bonus de 50 XP si RDV décroché
// - Bonus selon difficulté (récompense les niveaux supérieurs)
// - Bonus 20 si score >= 90 (perfect)
const DIFFICULTY_BONUS: Record<string, number> = {
  debutant: 0,
  intermediaire: 10,
  avance: 25,
  expert: 50,
};

export function xpForSession(s: SessionRow): number {
  if (s.status !== "completed") return 0;
  let xp = s.score ?? 0;
  if (s.appointment_secured) xp += 50;
  xp += DIFFICULTY_BONUS[s.difficulty] ?? 0;
  if ((s.score ?? 0) >= 90) xp += 20;
  return xp;
}

export function totalXp(sessions: SessionRow[]): number {
  return sessions.reduce((acc, s) => acc + xpForSession(s), 0);
}

// Courbe de niveau quasi-linéaire mais qui se durcit légèrement :
// niveau N atteint quand on a accumulé 200 * N + 30 * N^2 XP.
// Niveau 1 : 230 XP. Niveau 5 : 1750. Niveau 12 : 6720.
// Niveau 22 : 18920. Niveau 35 : 43750. Niveau 55 : 101750.
export function levelForXp(xp: number): number {
  let level = 0;
  while (xpToReachLevel(level + 1) <= xp) level += 1;
  return level;
}

export function xpToReachLevel(level: number): number {
  if (level <= 0) return 0;
  return 200 * level + 30 * level * level;
}

export interface LevelProgress {
  level: number;
  xpTotal: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  xpInLevel: number;
  xpToNext: number;
  progressPct: number;
}

export function levelProgress(xpTotal: number): LevelProgress {
  const level = levelForXp(xpTotal);
  const xpForCurrentLevel = xpToReachLevel(level);
  const xpForNextLevel = xpToReachLevel(level + 1);
  const xpInLevel = xpTotal - xpForCurrentLevel;
  const xpToNext = xpForNextLevel - xpTotal;
  const span = Math.max(1, xpForNextLevel - xpForCurrentLevel);
  const progressPct = Math.min(100, Math.round((xpInLevel / span) * 100));
  return {
    level,
    xpTotal,
    xpForCurrentLevel,
    xpForNextLevel,
    xpInLevel,
    xpToNext,
    progressPct,
  };
}

export function rankForLevel(level: number): RankConfig {
  let current = RANKS[0]!;
  for (const r of RANKS) {
    if (level >= r.minLevel) current = r;
    else break;
  }
  return current;
}

export function nextRank(level: number): RankConfig | null {
  for (const r of RANKS) {
    if (level < r.minLevel) return r;
  }
  return null;
}
