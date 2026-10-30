import { NextResponse } from "next/server";
import { withAuth, assertCan } from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { listMembers } from "@/lib/admin";
import { requireMembership } from "@/lib/membership";

export const GET = withAuth(async (_req, { session }) => {
  const ctx = await requireMembership(session.user.id);
  assertCan(abilities, session, "org.members.manage", ctx);

  return NextResponse.json({ members: await listMembers(ctx.orgId) });
});
