import { NextResponse } from "next/server";
import {
  withAuth,
  assertCan,
  auditLog,
  RequestValidationError,
} from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { requireMembership } from "@/lib/membership";
import { assertTicketVisible } from "@/lib/tickets";
import { prisma } from "@/lib/prisma";
import { RouteParams } from "@/lib/validation/ticket";

type Params = Promise<{ id: string }>;

export const POST = withAuth<Params>(async (_req, { session, params }) => {
  const parsed = RouteParams.safeParse(await params);
  if (!parsed.success) throw new RequestValidationError(parsed.error);
  const { id } = parsed.data;

  const ctx = await requireMembership(session.user.id);
  assertCan(abilities, session, "ticket.close", ctx);

  const ticket = await prisma.ticket.findFirst({
    where: { id, orgId: ctx.orgId },
  });
  assertTicketVisible(ticket, ctx);

  // Closing an already-closed ticket is a no-op: keep the original closedAt.
  if (ticket.status === "closed") {
    return NextResponse.json({ ticket });
  }

  const closed = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: "closed", closedAt: new Date() },
  });
  auditLog({
    event: "ticket.closed",
    resourceId: closed.id,
    metadata: { orgId: ctx.orgId },
  });

  return NextResponse.json({ ticket: closed });
});
