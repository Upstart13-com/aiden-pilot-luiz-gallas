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
import { assertAssigneeInOrg, assertTicketVisible } from "@/lib/tickets";
import { prisma } from "@/lib/prisma";
import { RouteParams, UpdateTicketBody } from "@/lib/validation/ticket";

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

export const PATCH = withAuth<Params>(async (req, { session, params }) => {
  const parsed = RouteParams.safeParse(await params);
  if (!parsed.success) throw new RequestValidationError(parsed.error);
  const { id } = parsed.data;
  const body = await parseRequest(req, UpdateTicketBody);

  const ctx = await requireMembership(session.user.id);
  assertCan(abilities, session, "ticket.update", ctx);

  await assertAssigneeInOrg(body.assigneeId, ctx.orgId);

  const ticket = await prisma.ticket.findFirst({
    where: { id, orgId: ctx.orgId },
  });
  assertTicketVisible(ticket, ctx);

  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: body,
  });
  auditLog({
    event: "ticket.updated",
    resourceId: updated.id,
    metadata: { orgId: ctx.orgId, fields: Object.keys(body) },
  });

  return NextResponse.json({ ticket: updated });
});
