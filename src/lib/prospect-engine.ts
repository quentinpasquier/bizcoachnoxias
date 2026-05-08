import { getAnthropic, PROSPECT_MODEL } from "./anthropic";
import { buildProspectSystemPrompt, getPersona } from "./personas";
import type { Client, Difficulty } from "./supabase/types";

export interface ConversationTurn {
  role: "user" | "prospect";
  content: string;
}

export interface ProspectReply {
  text: string;
  signal: ProspectSignal;
}

export type ProspectSignal =
  | { type: "continue" }
  | { type: "hangup"; reason: string }
  | { type: "appointment"; date: string };

const SIGNAL_REGEX =
  /\[(HANGUP|APPOINTMENT|CONTINUE)(?::([^\]]+))?\]\s*$/i;

function parseSignal(raw: string): { text: string; signal: ProspectSignal } {
  const match = raw.match(SIGNAL_REGEX);
  if (!match) {
    return { text: raw.trim(), signal: { type: "continue" } };
  }

  const [full, type, payload] = match;
  const text = raw.replace(full, "").trim();
  const upper = type.toUpperCase();

  if (upper === "HANGUP") {
    const reasonMatch = payload?.match(/reason\s*=\s*"([^"]*)"/i);
    return {
      text,
      signal: { type: "hangup", reason: reasonMatch?.[1] ?? "Pas intéressé" },
    };
  }

  if (upper === "APPOINTMENT") {
    const dateMatch = payload?.match(/date\s*=\s*"([^"]*)"/i);
    return {
      text,
      signal: { type: "appointment", date: dateMatch?.[1] ?? "À convenir" },
    };
  }

  return { text, signal: { type: "continue" } };
}

export async function generateProspectReply(args: {
  difficulty: Difficulty;
  personaKey: string;
  client: Client;
  history: ConversationTurn[];
}): Promise<ProspectReply> {
  const persona = getPersona(args.personaKey);
  if (!persona) {
    throw new Error(`Persona inconnu : ${args.personaKey}`);
  }

  const system = buildProspectSystemPrompt({
    persona,
    difficulty: args.difficulty,
    client: args.client,
  });

  const messages = args.history.map((turn) => ({
    role: (turn.role === "user" ? "user" : "assistant") as "user" | "assistant",
    content: turn.content,
  }));

  if (messages.length === 0) {
    messages.push({
      role: "user",
      content: "[Le téléphone sonne. Tu décroches.]",
    });
  }

  const response = await getAnthropic().messages.create({
    model: PROSPECT_MODEL,
    max_tokens: 400,
    system,
    messages,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Réponse Claude vide");
  }

  return parseSignal(textBlock.text);
}
