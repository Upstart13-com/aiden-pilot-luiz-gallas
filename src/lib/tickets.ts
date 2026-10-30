import "server-only";
import type { Prisma, Ticket } from "@/generated/prisma/client";
import { OwnershipError } from "@upstart13-com/aiden-security";
import { assertOwnership } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import type { MembershipContext } from "@/lib/membership";

/**
 * Ticket visibility, defined once so no route re-derives it.
 *
 * The matrix (docs/plans/deskline.md §3.3):
 *   owner  — every ticket in their org
 *   viewer — every ticket in their org, read-only (writes are stopped by
 *            `assertCan`, which is a 403, not by visibility)
 *   agent  — only tickets they own or are assigned to
 */

/**
 * The WHERE fragment that scopes a ticket query to what this caller may see.
 * Used for lists and single tickets alike, so another org's rows, and for an
 * agent another agent's rows, are never loaded at all.
 */
export function ticketVisibilityWhere(
  ctx: MembershipContext,
): Prisma.TicketWhereInput {
  if (ctx.role === "agent") {
    return {
      orgId: ctx.orgId,
      OR: [{ ownerId: ctx.userId }, { assigneeId: ctx.userId }],
    };
  }
  return { orgId: ctx.orgId };
}

/** Narrows a scoped lookup to a row; no row is the SDK's 404 + audit event. */
function assertTicketFound(
  ticket: Ticket | null,
  userId: string,
): asserts ticket is Ticket {
  if (!ticket) assertOwnership(null, userId);
}

/**
 * Loads one ticket in two steps (docs/plans/deskline.md §3.2):
 *   1. The query is scoped by `ticketVisibilityWhere`, so a ticket the caller
 *      may not see — another org's, or another agent's — matches no row.
 *   2. `assertOwnership` turns that missing row into a 404, so "doesn't exist"
 *      and "not yours" can't be told apart.
 */
export async function findVisibleTicket(
  id: string,
  ctx: MembershipContext,
): Promise<Ticket> {
  const ticket = await prisma.ticket.findFirst({
    where: { id, ...ticketVisibilityWhere(ctx) },
  });
  assertTicketFound(ticket, ctx.userId);
  return ticket;
}

/** Assignees must belong to the caller's org; anyone else is treated as not found (404). */
export async function assertAssigneeInOrg(
  assigneeId: string | null | undefined,
  orgId: string,
): Promise<void> {
  if (!assigneeId) return;
  const membership = await prisma.membership.findFirst({
    where: { userId: assigneeId, orgId },
    select: { id: true },
  });
  if (!membership) throw new OwnershipError();
}

/** Ticket counts for what the caller can see; urgent counts only active tickets. */
export async function ticketSummary(ctx: MembershipContext) {
  const visible = ticketVisibilityWhere(ctx);
  const count = (where: Prisma.TicketWhereInput) =>
    prisma.ticket.count({ where: { ...visible, ...where } });

  const [open, pending, resolved, closed, urgent] = await Promise.all([
    count({ status: "open" }),
    count({ status: "pending" }),
    count({ status: "resolved" }),
    count({ status: "closed" }),
    count({ priority: "urgent", status: { not: "closed" } }),
  ]);

  return { open, pending, resolved, closed, urgent };
}
