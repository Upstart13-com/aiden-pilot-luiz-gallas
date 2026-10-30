import { recordAIUsage } from "@upstart13-com/aiden-logging";

export type FakeAIMode = "ok" | "invalid" | "fail";

let mode: FakeAIMode = "ok";

export const TRIAGE_RESULT = {
  priority: "high",
  category: "Billing",
  sentiment: "negative",
} as const;

export const DRAFT_TOKENS = ["Thanks ", "for ", "reaching ", "out."];

export function setFakeAIMode(next: FakeAIMode): void {
  mode = next;
}

/** Mirrors what the real adapters do after each successful call. */
function reportUsage(): void {
  recordAIUsage({
    provider: "fake",
    model: "fake-model",
    promptTokens: 10,
    completionTokens: 5,
    totalTokens: 15,
    costUSD: 0.0001,
    latencyMs: 1,
  });
}

/** Stand-in for an aiden-ai client: no network, deterministic output. */
export function createFakeClient() {
  return {
    async complete() {
      if (mode === "fail") throw new Error("provider unavailable");
      reportUsage();
      return {
        text: "",
        toolCalls: [],
        parsed: mode === "invalid" ? { priority: "whenever" } : TRIAGE_RESULT,
        finishReason: "stop",
        model: "fake-model",
      };
    },
    async stream() {
      if (mode === "fail") throw new Error("provider unavailable");
      return {
        async *[Symbol.asyncIterator]() {
          for (const delta of DRAFT_TOKENS) yield { delta };
        },
        async finalResponse() {
          reportUsage();
          return { text: DRAFT_TOKENS.join("") };
        },
      };
    },
  };
}
