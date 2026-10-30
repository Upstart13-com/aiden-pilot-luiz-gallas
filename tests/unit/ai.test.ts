import { describe, expect, it, vi } from "vitest";

/** Load the real `@/lib/ai` against a config with the default provider on or off. */
async function loadAI(enabled: boolean) {
  vi.resetModules();
  vi.doMock("@/../aiden.config", async () => {
    const { aidenConfig } =
      await vi.importActual<typeof import("@/../aiden.config")>(
        "@/../aiden.config",
      );
    return {
      aidenConfig: {
        ...aidenConfig,
        ai: {
          ...aidenConfig.ai,
          defaultProvider: "anthropic",
          providers: { ...aidenConfig.ai.providers, anthropic: enabled },
        },
      },
    };
  });
  return vi.importActual<typeof import("@/lib/ai")>("@/lib/ai");
}

describe("defaultAI", () => {
  it("creates the client once and reuses it", async () => {
    const { defaultAI } = await loadAI(true);
    const first = defaultAI();
    expect(defaultAI()).toBe(first);
    await first;
  });

  it("refuses a default provider that isn't enabled", async () => {
    const { defaultAI } = await loadAI(false);
    expect(() => defaultAI()).toThrow(/is not enabled in aiden\.config\.ts/);
  });
});
