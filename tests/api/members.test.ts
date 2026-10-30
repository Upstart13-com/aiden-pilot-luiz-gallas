import { describe, expect, it } from "vitest";
import { GET as listMembers } from "@/app/api/members/route";
import { actAs } from "../support/fixtures";
import { call } from "../support/http";

describe("GET /api/members", () => {
  it("rejects signed-out callers with 401", async () => {
    expect((await call(listMembers, "GET")).status).toBe(401);
  });

  it("lists the caller's org members with explicit fields only", async () => {
    await actAs("acmeAgent");
    const { status, json } = await call(listMembers, "GET");
    expect(status).toBe(200);
    expect(json.members.map((m: { email: string }) => m.email).sort()).toEqual([
      "agent2@acme.test",
      "agent@acme.test",
      "owner@acme.test",
      "viewer@acme.test",
    ]);
    for (const m of json.members) {
      expect(Object.keys(m).sort()).toEqual([
        "email",
        "name",
        "role",
        "userId",
      ]);
    }
  });

  it("never lists another org's members", async () => {
    await actAs("globexAgent");
    const { json } = await call(listMembers, "GET");
    const emails = json.members.map((m: { email: string }) => m.email);
    expect(emails.every((e: string) => e.endsWith("@globex.test"))).toBe(true);
  });

  it("is readable by every role, for the assignee filter", async () => {
    await actAs("acmeViewer");
    expect((await call(listMembers, "GET")).status).toBe(200);
    await actAs("acmeOwner");
    expect((await call(listMembers, "GET")).status).toBe(200);
  });
});
