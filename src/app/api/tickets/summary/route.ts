import { NextResponse } from "next/server";
import { withAuth, assertCan } from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { requireMembership } from "@/lib/membership";
import { ticketSummary } from "@/lib/tickets";

export const GET = withAuth(async (_req, { session }) => {
  const ctx = await requireMembership(session.user.id);
  assertCan(abilities, session, "ticket.read", ctx);

  return NextResponse.json(await ticketSummary(ctx));
});
