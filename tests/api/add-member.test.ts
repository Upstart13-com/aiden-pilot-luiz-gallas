import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST as addMember } from "@/app/api/admin/members/route";
import { prisma } from "@/lib/prisma";
import { actAs, orgId } from "../support/fixtures";
import { call } from "../support/http";

const NEWCOMER = "newcomer@example.test";
let newcomerId: string;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: NEWCOMER } });
  newcomerId = (
    await prisma.user.create({ data: { email: NEWCOMER, name: "New Comer" } })
  ).id;
});

afterAll(async () => {
  // Deleting the user cascades to the membership the tests created.
  await prisma.user.deleteMany({ where: { email: NEWCOMER } });
});

const add = (body: unknown) => call(addMember, "POST", { body });

describe("POST /api/admin/members", () => {
  it("rejects signed-out callers with 401", async () => {
    expect((await add({ email: NEWCOMER, role: "agent" })).status).toBe(401);
  });

  it("forbids agents and viewers (403)", async () => {
    await actAs("acmeAgent");
    expect((await add({ email: NEWCOMER, role: "agent" })).status).toBe(403);
    await actAs("acmeViewer");
    expect((await add({ email: NEWCOMER, role: "agent" })).status).toBe(403);
  });

  it("rejects an invalid email or role with 400", async () => {
    await actAs("acmeOwner");
    expect((await add({ email: "not-an-email", role: "agent" })).status).toBe(
      400,
    );
    expect((await add({ email: NEWCOMER, role: "admin" })).status).toBe(400);
  });

  it("refuses an email with no account", async () => {
    await actAs("acmeOwner");
    const { status, json } = await add({
      email: "nobody@example.test",
      role: "agent",
    });
    expect(status).toBe(400);
    expect(json.error).toMatch(/register first/);
  });

  it("refuses someone in another org without naming it", async () => {
    await actAs("acmeOwner");
    const { status, json } = await add({
      email: "agent@globex.test",
      role: "agent",
    });
    expect(status).toBe(400);
    expect(json.error).toMatch(/another organization/);
    expect(json.error).not.toMatch(/globex/i);
  });

  it("adds a registered user to the owner's org, case-insensitively", async () => {
    await actAs("acmeOwner");
    const { status, json } = await add({
      email: NEWCOMER.toUpperCase(),
      role: "agent",
    });
    expect(status).toBe(201);
    expect(json.member).toMatchObject({
      userId: newcomerId,
      email: NEWCOMER,
      role: "agent",
    });

    const membership = await prisma.membership.findFirst({
      where: { userId: newcomerId },
    });
    expect(membership?.orgId).toBe(await orgId("acme"));

    await vi.waitFor(async () => {
      const entry = await prisma.auditLog.findFirst({
        where: { event: "member.added", resourceId: membership?.id },
      });
      expect(entry?.metadata).toMatchObject({ role: "agent" });
    });
  });

  it("refuses adding the same person twice", async () => {
    await actAs("acmeOwner");
    const { status, json } = await add({ email: NEWCOMER, role: "viewer" });
    expect(status).toBe(400);
    expect(json.error).toMatch(/already a member of your organization/);
  });

  it("refuses another org's owner adding someone already in acme", async () => {
    await actAs("globexOwner");
    const { status, json } = await add({ email: NEWCOMER, role: "agent" });
    expect(status).toBe(400);
    expect(json.error).toMatch(/another organization/);
  });
});
