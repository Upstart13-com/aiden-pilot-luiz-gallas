import { describe, expect, it } from "vitest";
import { OwnershipError } from "@upstart13-com/aiden-security";
import type { MembershipContext } from "@/lib/membership";
import {
  assertTicketOwner,
  assertTicketVisible,
  ticketVisibilityWhere,
} from "@/lib/tickets";

const ctx = (role: MembershipContext["role"]): MembershipContext => ({
  userId: "me",
  orgId: "org1",
  role,
});

const ticket = (ownerId: string, assigneeId: string | null = null) => ({
  id: "t1",
  ownerId,
  assigneeId,
});

describe("ticketVisibilityWhere", () => {
  it("scopes owners and viewers to the whole org", () => {
    expect(ticketVisibilityWhere(ctx("owner"))).toEqual({ orgId: "org1" });
    expect(ticketVisibilityWhere(ctx("viewer"))).toEqual({ orgId: "org1" });
  });

  it("scopes agents to tickets they own or are assigned", () => {
    expect(ticketVisibilityWhere(ctx("agent"))).toEqual({
      orgId: "org1",
      OR: [{ ownerId: "me" }, { assigneeId: "me" }],
    });
  });
});

describe("assertTicketVisible", () => {
  it("throws 404 for a missing ticket", () => {
    expect(() => assertTicketVisible(null, ctx("owner"))).toThrow(OwnershipError);
  });

  it("lets owners and viewers see any org ticket", () => {
    expect(() => assertTicketVisible(ticket("someone"), ctx("owner"))).not.toThrow();
    expect(() => assertTicketVisible(ticket("someone"), ctx("viewer"))).not.toThrow();
  });

  it("lets an agent see tickets they own", () => {
    expect(() => assertTicketVisible(ticket("me"), ctx("agent"))).not.toThrow();
  });

  it("lets an agent see tickets assigned to them", () => {
    expect(() =>
      assertTicketVisible(ticket("someone", "me"), ctx("agent"))
    ).not.toThrow();
  });

  it("hides another agent's ticket from an agent with a 404", () => {
    const run = () => assertTicketVisible(ticket("someone", "other"), ctx("agent"));
    expect(run).toThrow(OwnershipError);
    try {
      run();
    } catch (err) {
      expect((err as OwnershipError).status).toBe(404);
    }
  });
});

describe("assertTicketOwner", () => {
  it("passes for the owner and throws 404 otherwise", () => {
    expect(() => assertTicketOwner(ticket("me"), "me")).not.toThrow();
    expect(() => assertTicketOwner(ticket("someone"), "me")).toThrow(OwnershipError);
    expect(() => assertTicketOwner(undefined, "me")).toThrow(OwnershipError);
  });
});
