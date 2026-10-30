import { afterAll, describe, expect, it, vi } from "vitest";
import { POST as draft } from "@/app/api/tickets/[id]/draft/route";
import { prisma } from "@/lib/prisma";
import { deleteFakeUsage } from "../support/db";
import { DRAFT_TOKENS, setFakeAIMode } from "../support/fake-ai";
import { TICKETS, actAs, orgId } from "../support/fixtures";
import { call } from "../support/http";

afterAll(deleteFakeUsage);

const requestDraft = (id: string, body: unknown = {}) =>
  call(draft, "POST", { params: { id }, body });

describe("Phase 6 — POST /api/tickets/[id]/draft", () => {
  it("rejects signed-out callers with 401", async () => {
    expect((await requestDraft(TICKETS.agentOwned)).status).toBe(401);
  });

  it("forbids viewers and owners from invoking AI (403)", async () => {
    await actAs("acmeViewer");
    expect((await requestDraft(TICKETS.agentOwned)).status).toBe(403);
    await actAs("acmeOwner");
    expect((await requestDraft(TICKETS.agentOwned)).status).toBe(403);
  });

  it("hides other orgs' and other agents' tickets with 404", async () => {
    await actAs("globexAgent");
    expect((await requestDraft(TICKETS.agentOwned)).status).toBe(404);
    await actAs("acmeAgent");
    expect((await requestDraft(TICKETS.otherAgent)).status).toBe(404);
  });

  it("rejects an unknown tone with 400", async () => {
    await actAs("acmeAgent");
    expect((await requestDraft(TICKETS.agentOwned, { tone: "rude" })).status).toBe(400);
  });

  it("streams the draft as server-sent events", async () => {
    await actAs("acmeAgent");
    const { status, res } = await requestDraft(TICKETS.agentOwned);
    expect(status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const text = await res.text();
    const deltas = [...text.matchAll(/^data: (\{"delta".*\})$/gm)].map(
      (m) => JSON.parse(m[1]).delta
    );
    expect(deltas).toEqual(DRAFT_TOKENS);
    expect(text).toContain("event: done");
  });

  it("records draft usage against the caller's org", async () => {
    await deleteFakeUsage();
    await actAs("acmeAgent");
    const { res } = await requestDraft(TICKETS.agentOwned);
    await res.text();

    const acme = await orgId("acme");
    await vi.waitFor(async () => {
      const rows = await prisma.aIUsage.findMany({ where: { model: "fake-model" } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ orgId: acme, feature: "ticket.draft" });
    });
  });

  it("fails before streaming when the provider is unavailable", async () => {
    setFakeAIMode("fail");
    await actAs("acmeAgent");
    await expect(requestDraft(TICKETS.agentOwned)).rejects.toThrow("provider unavailable");
  });

  it("rate limits drafts to 10 per minute per user", async () => {
    // A user with no earlier drafts in this file; invalid bodies still count.
    await actAs("acmeAgent2");
    for (let i = 0; i < 10; i++) {
      expect((await requestDraft(TICKETS.otherAgent, { tone: "rude" })).status).toBe(400);
    }
    expect((await requestDraft(TICKETS.otherAgent, { tone: "rude" })).status).toBe(429);
  });
});
