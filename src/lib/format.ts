export function formatRelativeFr(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffH < 24) return `il y a ${diffH} h`;
  if (diffD < 7) return `il y a ${diffD} j`;

  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: now.getFullYear() === date.getFullYear() ? undefined : "numeric",
  });
}

// Date + heure au format français : "8 mai 2026, 14:32"
export function formatDateTimeFr(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Date seule : "8 mai 2026"
export function formatDateFr(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDuration(startIso: string, endIso: string | null): string {
  if (!endIso) return "·";
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  const seconds = Math.floor((end - start) / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}
