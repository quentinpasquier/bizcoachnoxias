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

export const PROSPECT_MODEL = "claude-sonnet-4-6";
export const EVALUATOR_MODEL = "claude-sonnet-4-6";
