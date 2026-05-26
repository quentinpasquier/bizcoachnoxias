import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY manquante. Configurez-la dans Vercel ou .env.local",
      );
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

// Prospect : Sonnet 4.6 pour la finesse du persona (nuances d'objection,
// ton réaliste, sous-entendus). Le surcoût de latence vs Haiku est compensé
// côté UX par la réduction des délais silence/respiration côté front.
export const PROSPECT_MODEL = "claude-sonnet-4-6";
// Évaluateur : Sonnet 4.6 pour qualité de diagnostic (précision des
// citations, finesse du vouvoiement, nuance du ton consultant senior).
// La route /api/sessions/[id]/evaluate a maxDuration=60s donc Sonnet
// tient largement même sur des transcripts de 5+ minutes.
export const EVALUATOR_MODEL = "claude-sonnet-4-6";
