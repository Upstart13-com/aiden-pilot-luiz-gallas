import { describe, expect, it } from "vitest";
import { GET as getMe } from "@/app/api/me/route";
import { GET as getSignins } from "@/app/api/me/signins/route";
import { prisma } from "@/lib/prisma";
import { actAs, orgId, userId } from "../support/fixtures";
import { call } from "../support/http";
import { signInAs } from "../support/session";

describe("GET /api/me", () => {
  it("rejects signed-out callers with 401", async () => {
    expect((await call(getMe, "GET")).status).toBe(401);
  });

  it("includes the caller's org and role", async () => {
    await actAs("acmeAgent");
    const { status, json } = await call(getMe, "GET");
    expect(status).toBe(200);
    expect(json.membership).toEqual({
      orgId: await orgId("acme"),
      role: "agent",
    });
    expect(json).not.toHaveProperty("passwordHash");
  });

  it("reports no membership for a user outside every org", async () => {
    const user = await prisma.user.create({
      data: { email: "no-org@example.test", name: "No Org" },
    });
    try {
      signInAs({ id: user.id, email: user.email });
      const { json } = await call(getMe, "GET");
      expect(json.membership).toBeNull();
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});

describe("GET /api/me/signins", () => {
  it("returns only the caller's own sign-ins", async () => {
    const me = await userId("acmeAgent");
    const other = await userId("globexOwner");
    await prisma.auditLog.createMany({
      data: [
        { id: "test_signin_me", event: "auth.signin", actorId: me },
        { id: "test_signin_other", event: "auth.signin", actorId: other },
      ],
    });
    try {
      await actAs("acmeAgent");
      const { json } = await call(getSignins, "GET");
      const ids = json.signins.map((s: { id: string }) => s.id);
      expect(ids).toContain("test_signin_me");
      expect(ids).not.toContain("test_signin_other");
    } finally {
      await prisma.auditLog.deleteMany({
        where: { id: { in: ["test_signin_me", "test_signin_other"] } },
      });
    }
  });
});
