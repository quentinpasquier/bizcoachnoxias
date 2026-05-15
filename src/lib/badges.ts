import type { SessionRow } from "./supabase/types";

export type BadgeRarity = "commun" | "rare" | "epique" | "legendaire";

export interface Badge {
  id: string;
  label: string;
  description: string;
  icon: string;
  rarity: BadgeRarity;
  xpReward: number;
  unlocked: boolean;
  progress?: { current: number; target: number };
}

export interface UserStats {
  totalSessions: number;
  completedSessions: number;
  rdvCount: number;
  rdvRate: number;
  avgScore: number | null;
  bestScore: number | null;
  scoreSum: number;
  perfectScores: number;
  expertSessions: number;
  consecutiveRdvs: number;
  distinctClients: number;
  distinctPersonas: number;
  daysActive: number;
}

export function computeStats(sessions: SessionRow[]): UserStats {
  const completed = sessions.filter((s) => s.status === "completed");
  const rdvCount = completed.filter((s) => s.appointment_secured).length;
  const rdvRate =
    completed.length > 0 ? Math.round((rdvCount / completed.length) * 100) : 0;

  const scores = completed
    .map((s) => s.score)
    .filter((s): s is number => typeof s === "number");
  const scoreSum = scores.reduce((a, b) => a + b, 0);
  const avgScore = scores.length > 0 ? Math.round(scoreSum / scores.length) : null;
  const bestScore = scores.length > 0 ? Math.max(...scores) : null;

  const perfectScores = scores.filter((s) => s >= 90).length;
  const expertSessions = completed.filter((s) => s.difficulty === "expert").length;

  const sortedByDate = [...completed].sort((a, b) =>
    a.started_at.localeCompare(b.started_at),
  );
  let consecutiveRdvs = 0;
  let currentStreak = 0;
  for (const s of sortedByDate) {
    if (s.appointment_secured) {
      currentStreak += 1;
      consecutiveRdvs = Math.max(consecutiveRdvs, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  const distinctClients = new Set(
    completed.map((s) => s.client_id).filter(Boolean),
  ).size;
  const distinctPersonas = new Set(completed.map((s) => s.persona_key)).size;

  const days = new Set(
    completed.map((s) => s.started_at.slice(0, 10)),
  );
  const daysActive = days.size;

  return {
    totalSessions: sessions.length,
    completedSessions: completed.length,
    rdvCount,
    rdvRate,
    avgScore,
    bestScore,
    scoreSum,
    perfectScores,
    expertSessions,
    consecutiveRdvs,
    distinctClients,
    distinctPersonas,
    daysActive,
  };
}

export function computeBadges(stats: UserStats): Badge[] {
  return [
    {
      id: "first_call",
      label: "Premier appel",
      description: "Décroche ton tout premier appel d'entraînement.",
      icon: "🎯",
      rarity: "commun",
      xpReward: 25,
      unlocked: stats.completedSessions >= 1,
      progress: { current: Math.min(stats.completedSessions, 1), target: 1 },
    },
    {
      id: "rookie",
      label: "Recrue",
      description: "Boucle 5 appels complets.",
      icon: "🥉",
      rarity: "commun",
      xpReward: 50,
      unlocked: stats.completedSessions >= 5,
      progress: { current: Math.min(stats.completedSessions, 5), target: 5 },
    },
    {
      id: "regular",
      label: "Régulier",
      description: "Atteins 25 appels d'entraînement.",
      icon: "🥈",
      rarity: "rare",
      xpReward: 150,
      unlocked: stats.completedSessions >= 25,
      progress: { current: Math.min(stats.completedSessions, 25), target: 25 },
    },
    {
      id: "centurion",
      label: "Centurion",
      description: "Le cap des 100 appels passés.",
      icon: "🥇",
      rarity: "legendaire",
      xpReward: 500,
      unlocked: stats.completedSessions >= 100,
      progress: { current: Math.min(stats.completedSessions, 100), target: 100 },
    },
    {
      id: "first_rdv",
      label: "Premier RDV",
      description: "Décroche ton premier rendez-vous.",
      icon: "📞",
      rarity: "commun",
      xpReward: 50,
      unlocked: stats.rdvCount >= 1,
      progress: { current: Math.min(stats.rdvCount, 1), target: 1 },
    },
    {
      id: "closer",
      label: "Closer",
      description: "10 RDV obtenus.",
      icon: "💼",
      rarity: "rare",
      xpReward: 200,
      unlocked: stats.rdvCount >= 10,
      progress: { current: Math.min(stats.rdvCount, 10), target: 10 },
    },
    {
      id: "machine",
      label: "Machine à RDV",
      description: "50 RDV au compteur.",
      icon: "🔥",
      rarity: "legendaire",
      xpReward: 600,
      unlocked: stats.rdvCount >= 50,
      progress: { current: Math.min(stats.rdvCount, 50), target: 50 },
    },
    {
      id: "perfect_score",
      label: "Sans-faute",
      description: "Décroche un score de 90 ou plus sur un appel.",
      icon: "⭐",
      rarity: "epique",
      xpReward: 250,
      unlocked: stats.perfectScores >= 1,
    },
    {
      id: "consistent",
      label: "Régularité",
      description: "Atteins 70 % de RDV décrochés sur tes appels (min. 10).",
      icon: "📈",
      rarity: "epique",
      xpReward: 300,
      unlocked: stats.completedSessions >= 10 && stats.rdvRate >= 70,
    },
    {
      id: "expert_pass",
      label: "Boss final",
      description: "Boucle un appel en mode Expert avec un RDV.",
      icon: "🏆",
      rarity: "epique",
      xpReward: 250,
      unlocked: stats.expertSessions >= 1 && stats.rdvCount >= 1,
    },
    {
      id: "streak_3",
      label: "Triple combo",
      description: "Enchaîne 3 RDV d'affilée.",
      icon: "🎰",
      rarity: "rare",
      xpReward: 150,
      unlocked: stats.consecutiveRdvs >= 3,
      progress: { current: Math.min(stats.consecutiveRdvs, 3), target: 3 },
    },
    {
      id: "explorer",
      label: "Explorateur",
      description: "Travaille sur 5 clients différents.",
      icon: "🧭",
      rarity: "rare",
      xpReward: 150,
      unlocked: stats.distinctClients >= 5,
      progress: { current: Math.min(stats.distinctClients, 5), target: 5 },
    },
    {
      id: "polyvalent",
      label: "Polyvalent",
      description: "Affronte 5 personas différents.",
      icon: "🎭",
      rarity: "rare",
      xpReward: 150,
      unlocked: stats.distinctPersonas >= 5,
      progress: { current: Math.min(stats.distinctPersonas, 5), target: 5 },
    },
    {
      id: "daily",
      label: "Discipliné",
      description: "Pratique sur 7 jours différents.",
      icon: "📅",
      rarity: "epique",
      xpReward: 200,
      unlocked: stats.daysActive >= 7,
      progress: { current: Math.min(stats.daysActive, 7), target: 7 },
    },
  ];
}

export function leaderboardScore(stats: UserStats): number {
  return (
    stats.rdvCount * 50 +
    stats.scoreSum +
    stats.perfectScores * 25 +
    stats.expertSessions * 15
  );
}
