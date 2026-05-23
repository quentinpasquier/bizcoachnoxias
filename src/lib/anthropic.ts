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

// Prospect : Haiku 4.5 pour réponses dynamiques (~500ms vs ~2s avec Sonnet).
// Les répliques sont courtes (max 220 tokens) et le persona est déjà cadré
// par un prompt système détaillé, donc Haiku 4.5 le respecte parfaitement.
// Le gain de vitesse (~3-4x) est ce qui rend la conversation vivante :
// avec Sonnet, il y avait un blanc gênant après chaque tirade du commercial.
export const PROSPECT_MODEL = "claude-haiku-4-5-20251001";
// Évaluateur : Haiku 4.5 pour passer le timeout Vercel (10s sur Hobby).
// L'analyse de transcript et la production de JSON structuré sont des
// tâches où Haiku 4.5 est largement suffisant et 5-10x plus rapide.
export const EVALUATOR_MODEL = "claude-haiku-4-5-20251001";
