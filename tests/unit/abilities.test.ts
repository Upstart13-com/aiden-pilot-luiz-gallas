import { describe, expect, it } from "vitest";
import type { SecuritySession } from "@upstart13-com/aiden-security";
import { abilities } from "@/lib/abilities";

const session: SecuritySession = {
  user: { id: "u1", email: null, name: null, image: null, roles: [] },
};

const can = (resource: unknown, action: string) =>
  abilities.can(session, action, resource);

// The persona table, row by row.
const MATRIX = {
  owner: [
    "ticket.read",
    "org.members.manage",
    "org.audit.read",
    "org.usage.read",
  ],
  agent: [
    "ticket.read",
    "ticket.create",
    "ticket.update",
    "ticket.close",
    "ai.invoke",
  ],
  viewer: ["ticket.read"],
} as const;

const ALL_ACTIONS = [
  "ticket.read",
  "ticket.create",
  "ticket.update",
  "ticket.close",
  "ai.invoke",
  "org.members.manage",
  "org.audit.read",
  "org.usage.read",
];

describe("ability matrix", () => {
  for (const [role, allowed] of Object.entries(MATRIX)) {
    for (const action of ALL_ACTIONS) {
      const expected = (allowed as readonly string[]).includes(action);
      it(`${role} ${expected ? "can" : "cannot"} ${action}`, () => {
        expect(can({ role }, action)).toBe(expected);
      });
    }
  }

  it("denies a missing resource", () => {
    expect(can(undefined, "ticket.read")).toBe(false);
  });

  it("denies an unknown role", () => {
    expect(can({ role: "superuser" }, "ticket.read")).toBe(false);
  });

  it("denies a resource without a role", () => {
    expect(can({}, "ticket.read")).toBe(false);
  });

  it("denies actions outside the matrix", () => {
    expect(can({ role: "owner" }, "users.manage")).toBe(false);
  });
});
