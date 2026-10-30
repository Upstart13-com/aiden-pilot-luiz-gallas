import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as listMembers } from "@/app/api/admin/members/route";
import { PATCH as changeRole } from "@/app/api/admin/members/[id]/route";
import { GET as readAudit } from "@/app/api/admin/audit/route";
import { GET as readUsage } from "@/app/api/admin/usage/route";
import { prisma } from "@/lib/prisma";
import { resetFixtures } from "../support/db";
import { actAs, membershipId, orgId, userId } from "../support/fixtures";
import { call } from "../support/http";

const USAGE_IDS = ["test_usage_acme_triage", "test_usage_acme_draft", "test_usage_globex"];

beforeAll(async () => {
  const [acme, globex] = [await orgId("acme"), await orgId("globex")];
  const row = (id: string, org: string, feature: string, cost: number) => ({
    id,
    orgId: org,
    feature,
    provider: "anthropic",
    model: "test-model",
    promptTokens: 100,
    completionTokens: 20,
    totalTokens: 120,
    costUSD: cost,
    latencyMs: 300,
  });
  await prisma.aIUsage.createMany({
    data: [
      row(USAGE_IDS[0], acme, "ticket.triage", 0.00025),
      row(USAGE_IDS[1], acme, "ticket.draft", 0.0015),
      row(USAGE_IDS[2], globex, "ticket.draft", 0.0021),
    ],
  });
});

afterAll(async () => {
  await prisma.aIUsage.deleteMany({ where: { id: { in: USAGE_IDS } } });
  resetFixtures();
});

const setRole = async (memberId: string, role: string) =>
  call(changeRole, "PATCH", { params: { id: memberId }, body: { role } });

describe("owner-only access", () => {
  const routes = [
    ["members", () => call(listMembers, "GET")],
    ["audit", () => call(readAudit, "GET")],
    ["usage", () => call(readUsage, "GET")],
  ] as const;

  for (const [name, request] of routes) {
    it(`rejects signed-out callers from ${name} with 401`, async () => {
      expect((await request()).status).toBe(401);
    });

    it(`forbids agents and viewers from ${name} (403)`, async () => {
      await actAs("acmeAgent");
      expect((await request()).status).toBe(403);
      await actAs("acmeViewer");
      expect((await request()).status).toBe(403);
    });
  }
});

describe("7a GET /api/admin/members", () => {
  it("lists only the caller's org", async () => {
    await actAs("acmeOwner");
    const { status, json } = await call(listMembers, "GET");
    expect(status).toBe(200);
    expect(json.members.map((m: { email: string }) => m.email).sort()).toEqual([
      "agent2@acme.test",
      "agent@acme.test",
      "owner@acme.test",
      "viewer@acme.test",
    ]);
  });
});

describe("7b PATCH /api/admin/members/[id]", () => {
  it("changes a member's role and records it", async () => {
    await actAs("acmeOwner");
    const id = await membershipId("acmeAgent2");
    const { status, json } = await setRole(id, "viewer");
    expect(status).toBe(200);
    expect(json.member.role).toBe("viewer");

    await vi.waitFor(async () => {
      const entry = await prisma.auditLog.findFirst({
        where: { event: "member.role_changed", resourceId: id },
        orderBy: { timestamp: "desc" },
      });
      expect(entry?.metadata).toMatchObject({ from: "agent", to: "viewer" });
    });

    expect((await setRole(id, "agent")).status).toBe(200);
  });

  it("hides another org's members with 404", async () => {
    await actAs("globexOwner");
    expect((await setRole(await membershipId("acmeAgent2"), "viewer")).status).toBe(404);
  });

  it("refuses to let the last owner demote themself (400)", async () => {
    await actAs("acmeOwner");
    const { status } = await setRole(await membershipId("acmeOwner"), "agent");
    expect(status).toBe(400);
    const owners = await prisma.membership.count({
      where: { orgId: await orgId("acme"), role: "owner" },
    });
    expect(owners).toBe(1);
  });

  it("rejects an unknown role with 400", async () => {
    await actAs("acmeOwner");
    expect((await setRole(await membershipId("acmeAgent2"), "admin")).status).toBe(400);
  });

  it("forbids agents from changing roles (403)", async () => {
    await actAs("acmeAgent");
    expect((await setRole(await membershipId("acmeAgent2"), "viewer")).status).toBe(403);
  });
});

describe("7c GET /api/admin/audit", () => {
  it("returns only entries by the caller's org members", async () => {
    await actAs("acmeOwner");
    const acmeMembers = await prisma.membership.findMany({
      where: { orgId: await orgId("acme") },
      select: { userId: true },
    });
    const allowed = new Set(acmeMembers.map((m) => m.userId));

    const { status, json } = await call(readAudit, "GET", { query: { limit: "200" } });
    expect(status).toBe(200);
    expect(json.entries.length).toBeGreaterThan(0);
    for (const entry of json.entries) expect(allowed.has(entry.actorId)).toBe(true);
  });

  it("excludes entries by other orgs' members", async () => {
    await actAs("acmeOwner");
    const globexOwner = await userId("globexOwner");
    const { json } = await call(readAudit, "GET", { query: { limit: "200" } });
    expect(json.entries.some((e: { actorId: string }) => e.actorId === globexOwner)).toBe(false);
  });

  it("filters by event", async () => {
    await actAs("acmeOwner");
    const { json } = await call(readAudit, "GET", {
      query: { event: "member.role_changed" },
    });
    expect(json.entries.length).toBeGreaterThan(0);
    for (const entry of json.entries) expect(entry.event).toBe("member.role_changed");
  });

  it("rejects a page size over 200 with 400", async () => {
    await actAs("acmeOwner");
    expect((await call(readAudit, "GET", { query: { limit: "201" } })).status).toBe(400);
  });
});

describe("7d GET /api/admin/usage", () => {
  it("totals only the caller's org", async () => {
    await actAs("acmeOwner");
    const { status, json } = await call(readUsage, "GET");
    expect(status).toBe(200);

    const ids = json.recent.map((r: { id: string }) => r.id);
    expect(ids).toEqual(expect.arrayContaining([USAGE_IDS[0], USAGE_IDS[1]]));
    expect(ids).not.toContain(USAGE_IDS[2]);

    const acme = await orgId("acme");
    for (const r of json.recent) expect(r.orgId).toBe(acme);
  });

  it("breaks spend down by feature, matching the org's rows", async () => {
    await actAs("acmeOwner");
    const { json } = await call(readUsage, "GET");
    const expected = await prisma.aIUsage.groupBy({
      by: ["feature"],
      where: { orgId: await orgId("acme") },
      _sum: { costUSD: true },
    });
    for (const group of expected) {
      const reported = json.byFeature.find(
        (f: { feature: string | null }) => f.feature === group.feature
      );
      expect(reported.costUSD).toBeCloseTo(Number(group._sum.costUSD ?? 0));
    }
    expect(json.byFeature).toHaveLength(expected.length);
  });

  it("shows another org only its own spend", async () => {
    await actAs("globexOwner");
    const { json } = await call(readUsage, "GET");
    const ids = json.recent.map((r: { id: string }) => r.id);
    expect(ids).toContain(USAGE_IDS[2]);
    expect(ids).not.toContain(USAGE_IDS[0]);
  });
});
