import { describe, expect, it, vi } from "vitest";

describe("defaultAI", () => {
  it("creates the client once and reuses it", async () => {
    const { defaultAI } =
      await vi.importActual<typeof import("@/lib/ai")>("@/lib/ai");
    const first = defaultAI();
    expect(defaultAI()).toBe(first);
    await first;
  });
});
