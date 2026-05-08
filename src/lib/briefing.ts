import type { PersonaProfile } from "./supabase/types";

// Renvoie 4 à 6 bullets prêts à afficher pour le brief de préparation
// d'un persona. Utilise prep_bullets si dispo (extraction récente),
// sinon découpe prep_briefing en bullets : bullets natifs (-, *, •),
// puis paragraphes, puis phrases.
export function getPersonaBullets(profile: PersonaProfile, max = 6): string[] {
  if (Array.isArray(profile.prep_bullets) && profile.prep_bullets.length > 0) {
    return profile.prep_bullets.slice(0, max).map((b) => b.trim()).filter(Boolean);
  }

  const briefing = (profile.prep_briefing ?? "").trim();
  if (!briefing) return [];

  // Bullets natifs détectés
  const bulletRegex = /^[\s]*[-•*][\s]+(.+)$/gm;
  const bulletMatches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = bulletRegex.exec(briefing)) !== null) {
    const txt = m[1].trim();
    if (txt) bulletMatches.push(txt);
  }
  if (bulletMatches.length >= 3) return bulletMatches.slice(0, max);

  // Paragraphes
  const paragraphs = briefing
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter(Boolean);
  if (paragraphs.length >= 3) return paragraphs.slice(0, max);

  // Phrases
  const sentences = briefing
    .split(/(?<=[.!?])\s+(?=[A-ZÀÂÉÈÊËÎÏÔÖÙÛÜŒŸ])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
  return sentences.slice(0, max);
}
