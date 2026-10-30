import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { MembershipRole } from "@/generated/prisma/enums";
import { assertOwnership } from "@/lib/security";
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

/** Minimal shape the guards need — any ticket selection satisfying it works. */
type TicketRow = {
  id: string;
  ownerId: string;
  assigneeId: string | null;
};

/**
 * The WHERE fragment that scopes a list query to what this caller may see.
 *
 * The agent restriction lives in the WHERE clause rather than a post-fetch
 * filter, so another agent's rows are never loaded into memory at all.
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

/**
 * IDOR guard for a single ticket, delegating to the SDK's `assertOwnership`.
 *
 * `assertOwnership` is hard-typed to a `userId` field and reads `.userId` at
 * runtime, while a Ticket names that column `ownerId` (D2). Projecting at the
 * call site would lose TypeScript's narrowing, so this wrapper restores it
 * while keeping the SDK as the single source of the 404 and of the
 * `security.ownership_failed` audit event. Gap G1 is filed upstream.
 */
export function assertTicketOwner<T extends { id: string; ownerId: string }>(
  ticket: T | null | undefined,
  userId: string,
): asserts ticket is T {
  assertOwnership(
    ticket ? { id: ticket.id, userId: ticket.ownerId } : null,
    userId,
  );
}

/**
 * Full row-visibility guard. Throws `OwnershipError` (404) when the ticket is
 * missing, or when an agent reaches a row they neither own nor are assigned.
 *
 * Both cases are 404 on purpose: "no such ticket" and "not yours" must be
 * indistinguishable, or the response enumerates valid ids. Capability
 * failures (a viewer trying to mutate) are a separate axis and surface as
 * 403 via `assertCan` — see docs/plans/deskline.md §3.1.
 *
 * Call it AFTER an org-scoped query. The `orgId` in the WHERE clause is what
 * makes a cross-tenant id arrive here as `null`.
 */
export function assertTicketVisible<T extends TicketRow>(
  ticket: T | null | undefined,
  ctx: { role: MembershipRole; userId: string },
): asserts ticket is T {
  const agentCannotSee =
    ctx.role === "agent" && ticket?.assigneeId !== ctx.userId;

  if (!ticket || agentCannotSee) {
    // Missing row, or an agent who is not the assignee: ownership is the
    // last way in. A null ticket falls through to the same 404.
    assertTicketOwner(ticket, ctx.userId);
  }
}
