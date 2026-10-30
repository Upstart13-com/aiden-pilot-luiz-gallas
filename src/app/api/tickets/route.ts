import { NextResponse } from "next/server";
import {
  withAuth,
  assertCan,
  auditLog,
  parseRequest,
  RequestValidationError,
} from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { requireMembership } from "@/lib/membership";
import {
  assertAssigneeInOrg,
  ticketSelect,
  ticketVisibilityWhere,
} from "@/lib/tickets";
import { prisma } from "@/lib/prisma";
import { triageTicket } from "@/lib/triage";
import { CreateTicketBody, ListTicketsQuery } from "@/lib/validation/ticket";

export const GET = withAuth(async (req, { session }) => {
  const url = new URL(req.url);
  const parsed = ListTicketsQuery.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!parsed.success) throw new RequestValidationError(parsed.error);
  const { status, priority, cursor, limit } = parsed.data;

  const ctx = await requireMembership(session.user.id);
  assertCan(abilities, session, "ticket.read", ctx);

  const rows = await prisma.ticket.findMany({
    where: { ...ticketVisibilityWhere(ctx), status, priority },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: ticketSelect,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const tickets = rows.slice(0, limit);
  const nextCursor =
    rows.length > limit ? tickets[tickets.length - 1].id : null;

  return NextResponse.json({ tickets, nextCursor });
});

export const POST = withAuth(async (req, { session }) => {
  const body = await parseRequest(req, CreateTicketBody);

  const ctx = await requireMembership(session.user.id);
  assertCan(abilities, session, "ticket.create", ctx);
  // Creating a ticket runs AI triage, so the caller must be allowed to invoke AI.
  assertCan(abilities, session, "ai.invoke", ctx);
  await assertAssigneeInOrg(body.assigneeId, ctx.orgId);

  const created = await prisma.ticket.create({
    data: {
      orgId: ctx.orgId,
      ownerId: ctx.userId,
      assigneeId: body.assigneeId,
      subject: body.subject,
      body: body.body,
    },
    select: ticketSelect,
  });
  const ticket = await triageTicket(created, ctx);
  auditLog({
    event: "ticket.create",
    resourceId: ticket.id,
    metadata: { orgId: ctx.orgId },
  });

  return NextResponse.json({ ticket }, { status: 201 });
});
