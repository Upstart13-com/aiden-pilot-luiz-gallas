/**
 * Provider-agnostic AI client. `ai.defaultProvider` in aiden.config.ts picks
 * the provider, `ai.providers` must have it enabled, and `ai.models` sets its
 * model, so switching vendors is a one-line config change with no route
 * edits. Install the matching provider SDK for whichever is enabled.
 */

import { createAIClient, type AIClient } from "@upstart13-com/aiden-ai";
import { aidenConfig } from "@/../aiden.config";

const models = aidenConfig.ai.models;

export const ai = {
  openai: (model: string = models.openai): Promise<AIClient> =>
    createAIClient({
      provider: "openai",
      model,
      apiKey: process.env.OPENAI_API_KEY,
    }),
  anthropic: (model: string = models.anthropic): Promise<AIClient> =>
    createAIClient({
      provider: "anthropic",
      model,
      apiKey: process.env.ANTHROPIC_API_KEY,
    }),
  google: (model: string = models.google): Promise<AIClient> =>
    createAIClient({
      provider: "google",
      model,
      apiKey: process.env.GOOGLE_API_KEY,
    }),
  mistral: (model: string = models.mistral): Promise<AIClient> =>
    createAIClient({
      provider: "mistral",
      model,
      apiKey: process.env.MISTRAL_API_KEY,
    }),
  groq: (model: string = models.groq): Promise<AIClient> =>
    createAIClient({
      provider: "groq",
      model,
      apiKey: process.env.GROQ_API_KEY,
    }),
  cohere: (model: string = models.cohere): Promise<AIClient> =>
    createAIClient({
      provider: "cohere",
      model,
      apiKey: process.env.COHERE_API_KEY,
    }),
};

const provider = aidenConfig.ai.defaultProvider;
let client: Promise<AIClient> | undefined;

/**
 * The app's AI client, created once and reused. Throws if the configured
 * provider is not enabled in `ai.providers`.
 */
export function defaultAI(): Promise<AIClient> {
  if (!aidenConfig.ai.providers[provider]) {
    throw new Error(
      `ai.defaultProvider "${provider}" is not enabled in aiden.config.ts ai.providers.`,
    );
  }
  // Drop a failed creation (e.g. a missing SDK) so the next call retries.
  client ??= ai[provider]().catch((err: unknown) => {
    client = undefined;
    throw err;
  });
  return client;
}
