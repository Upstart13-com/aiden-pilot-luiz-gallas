import { NextResponse } from "next/server";
import { withAuth, assertCan, RequestValidationError } from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { requireMembership } from "@/lib/membership";
import { assertTicketVisible } from "@/lib/tickets";
import { prisma } from "@/lib/prisma";
import { RouteParams } from "@/lib/validation/ticket";

type Params = Promise<{ id: string }>;

export const GET = withAuth<Params>(async (_req, { session, params }) => {
  const parsed = RouteParams.safeParse(await params);
  if (!parsed.success) throw new RequestValidationError(parsed.error);
  const { id } = parsed.data;

  const ctx = await requireMembership(session.user.id);
  assertCan(abilities, session, "ticket.read", ctx);

  const ticket = await prisma.ticket.findFirst({
    where: { id, orgId: ctx.orgId },
  });
  assertTicketVisible(ticket, ctx);

  return NextResponse.json({ ticket });
});
