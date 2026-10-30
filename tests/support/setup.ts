import { beforeEach, vi } from "vitest";
import { resetFakeAI } from "./fake-ai";
import { signInAs } from "./session";

// Every test file sees these mocks: sessions are set with `signInAs`, and AI
// calls go to a deterministic fake instead of a real provider.
vi.mock("@/lib/auth", async () => {
  const { currentSession } = await import("./session");
  return {
    auth: async () => currentSession(),
    handlers: {},
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
});

vi.mock("@/lib/ai", async () => {
  const { createFakeClient } = await import("./fake-ai");
  return { ai: {}, defaultAI: async () => createFakeClient() };
});

beforeEach(() => {
  signInAs(null);
  resetFakeAI();
});
