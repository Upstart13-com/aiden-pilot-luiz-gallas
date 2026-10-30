import { describe, expect, it } from "vitest";
import type { MembershipContext } from "@/lib/membership";
import { ticketVisibilityWhere } from "@/lib/tickets";

const ctx = (role: MembershipContext["role"]): MembershipContext => ({
  userId: "me",
  orgId: "org1",
  role,
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
