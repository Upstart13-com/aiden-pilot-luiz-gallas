import { recordAIUsage } from "@upstart13-com/aiden-logging";

export type FakeAIMode = "ok" | "invalid" | "fail";

let mode: FakeAIMode = "ok";

type FakeCall = {
  method: "complete" | "stream";
  system?: string;
  messages: { role: string; content: string }[];
  maxTokens?: number;
};

/** Every request the fake client received, for asserting on prompts and limits. */
export const aiCalls: FakeCall[] = [];

export const TRIAGE_RESULT = {
  priority: "high",
  category: "Billing",
  sentiment: "negative",
} as const;

export const DRAFT_TOKENS = ["Thanks ", "for ", "reaching ", "out."];

export function setFakeAIMode(next: FakeAIMode): void {
  mode = next;
}

export function resetFakeAI(): void {
  mode = "ok";
  aiCalls.length = 0;
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
    async complete(opts: Omit<FakeCall, "method">) {
      aiCalls.push({ method: "complete", ...opts });
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
    async stream(opts: Omit<FakeCall, "method">) {
      aiCalls.push({ method: "stream", ...opts });
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
