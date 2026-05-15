import type { SessionRow } from "./supabase/types";

export interface DailyMission {
  id: string;
  label: string;
  description: string;
  icon: string;
  target: number;
  current: number;
  done: boolean;
  xpReward: number;
}

interface MissionDef {
  id: string;
  label: string;
  description: string;
  icon: string;
  target: number;
  xpReward: number;
  compute: (s: SessionRow[]) => number;
}

const POOL: MissionDef[] = [
  {
    id: "calls_3",
    label: "Triple cadence",
    description: "Boucle 3 appels aujourd'hui.",
    icon: "📞",
    target: 3,
    xpReward: 80,
    compute: (s) => s.length,
  },
  {
    id: "rdv_1",
    label: "Un de plus",
    description: "Décroche au moins 1 RDV aujourd'hui.",
    icon: "🎯",
    target: 1,
    xpReward: 120,
    compute: (s) => s.filter((x) => x.appointment_secured).length,
  },
  {
    id: "expert_1",
    label: "Choisis ton boss",
    description: "Affronte le mode Expert.",
    icon: "👹",
    target: 1,
    xpReward: 100,
    compute: (s) => s.filter((x) => x.difficulty === "expert").length,
  },
  {
    id: "perfect_1",
    label: "Sans-faute",
    description: "Décroche un score ≥ 85 aujourd'hui.",
    icon: "⭐",
    target: 1,
    xpReward: 150,
    compute: (s) => s.filter((x) => (x.score ?? 0) >= 85).length,
  },
  {
    id: "new_client",
    label: "Terrain inconnu",
    description: "Lance un appel sur un nouveau client aujourd'hui.",
    icon: "🧭",
    target: 1,
    xpReward: 80,
    compute: (s) => new Set(s.map((x) => x.client_id).filter(Boolean)).size,
  },
  {
    id: "avg_70",
    label: "Régulier",
    description: "Atteins 70 de moyenne sur 3 appels aujourd'hui.",
    icon: "📈",
    target: 1,
    xpReward: 130,
    compute: (s) => {
      const completed = s.filter((x) => x.status === "completed" && typeof x.score === "number");
      if (completed.length < 3) return 0;
      const avg =
        completed.reduce((a, x) => a + (x.score ?? 0), 0) / completed.length;
      return avg >= 70 ? 1 : 0;
    },
  },
  {
    id: "two_personas",
    label: "Polyvalent",
    description: "Affronte 2 personas différents aujourd'hui.",
    icon: "🎭",
    target: 2,
    xpReward: 90,
    compute: (s) => new Set(s.map((x) => x.persona_key)).size,
  },
];

// 3 missions choisies déterministiquement par date + user.
// Pas de stockage : recalculé à chaque page load.
function dailySeed(userId: string): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  return `${userId}-${ymd}`;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function pickDailyMissions(
  userId: string,
  todaysSessions: SessionRow[],
): DailyMission[] {
  const seed = dailySeed(userId);
  const seedNum = hash(seed);
  // Sélection rotative : 3 missions du pool décalées par seed quotidien.
  const start = seedNum % POOL.length;
  const picked: MissionDef[] = [];
  for (let i = 0; i < 3; i++) {
    picked.push(POOL[(start + i) % POOL.length]!);
  }
  return picked.map((m) => {
    const current = m.compute(todaysSessions);
    return {
      id: m.id,
      label: m.label,
      description: m.description,
      icon: m.icon,
      target: m.target,
      current: Math.min(current, m.target),
      done: current >= m.target,
      xpReward: m.xpReward,
    };
  });
}

export function filterTodaysSessions(sessions: SessionRow[]): SessionRow[] {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  return sessions.filter((s) => {
    const dt = new Date(s.started_at);
    return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
  });
}
