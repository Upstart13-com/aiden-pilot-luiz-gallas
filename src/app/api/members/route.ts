import { NextResponse } from "next/server";
import { withAuth, assertCan } from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { listOrgMembers, requireMembership } from "@/lib/membership";

/** The caller's org members, for the assignee picker and the assignee filter. */
export const GET = withAuth(async (_req, { session }) => {
  const ctx = await requireMembership(session.user.id);
  assertCan(abilities, session, "ticket.read", ctx);

  return NextResponse.json({ members: await listOrgMembers(ctx.orgId) });
});
