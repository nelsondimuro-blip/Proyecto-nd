import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY no está configurada");
    client = new Anthropic({ apiKey });
  }
  return client;
}

export const MODELS = {
  intake: "claude-haiku-4-5-20251001",
  procurement: "claude-haiku-4-5-20251001",
  inmobiliaria: "claude-haiku-4-5-20251001",
  advisor: "claude-opus-4-7",
} as const;
