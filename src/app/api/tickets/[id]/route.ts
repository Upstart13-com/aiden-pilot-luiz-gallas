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
import { assertAssigneeInOrg, findVisibleTicket } from "@/lib/tickets";
import { prisma } from "@/lib/prisma";
import { triageTicket } from "@/lib/triage";
import { RouteParams, UpdateTicketBody } from "@/lib/validation/ticket";

type Params = Promise<{ id: string }>;

export const GET = withAuth<Params>(async (_req, { session, params }) => {
  const parsed = RouteParams.safeParse(await params);
  if (!parsed.success) throw new RequestValidationError(parsed.error);
  const { id } = parsed.data;

  const ctx = await requireMembership(session.user.id);
  assertCan(abilities, session, "ticket.read", ctx);

  const ticket = await findVisibleTicket(id, ctx);
  const people = await prisma.ticket.findUniqueOrThrow({
    where: { id: ticket.id },
    select: {
      owner: { select: { name: true, email: true } },
      assignee: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json({ ticket: { ...ticket, ...people } });
});

export const PATCH = withAuth<Params>(async (req, { session, params }) => {
  const parsed = RouteParams.safeParse(await params);
  if (!parsed.success) throw new RequestValidationError(parsed.error);
  const { id } = parsed.data;
  const body = await parseRequest(req, UpdateTicketBody);

  const ctx = await requireMembership(session.user.id);
  assertCan(abilities, session, "ticket.update", ctx);
  const contentChanged = body.subject !== undefined || body.body !== undefined;
  // Editing the content re-runs AI triage, so the caller must be allowed to invoke AI.
  if (contentChanged) assertCan(abilities, session, "ai.invoke", ctx);

  await assertAssigneeInOrg(body.assigneeId, ctx.orgId);

  const ticket = await findVisibleTicket(id, ctx);

  const saved = await prisma.ticket.update({
    where: { id: ticket.id },
    data: body,
  });
  const updatedTicket =
    contentChanged && saved.status !== "closed"
      ? await triageTicket(saved, ctx)
      : saved;
  auditLog({
    event: "ticket.updated",
    resourceId: updatedTicket.id,
    metadata: { orgId: ctx.orgId, fields: Object.keys(body) },
  });

  return NextResponse.json({ ticket: updatedTicket });
});
