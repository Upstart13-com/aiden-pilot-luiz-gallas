import { NextResponse } from "next/server";
import { withAuth, assertCan, RequestValidationError } from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { requireMembership } from "@/lib/membership";
import { prisma } from "@/lib/prisma";
import { AuditQuery } from "@/lib/validation/admin";

/**
 * Org-scoped audit trail. The SDK's `auditReader` has no tenant filter
 * (gap G2), so this reads the AuditLog table directly, limited to entries
 * whose actor is a member of the caller's org.
 */
export const GET = withAuth(async (req, { session }) => {
  const url = new URL(req.url);
  const parsed = AuditQuery.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) throw new RequestValidationError(parsed.error);
  const { event, cursor, limit } = parsed.data;

  const ctx = await requireMembership(session.user.id);
  assertCan(abilities, session, "org.audit.read", ctx);

  const members = await prisma.membership.findMany({
    where: { orgId: ctx.orgId },
    select: { userId: true },
  });

  const rows = await prisma.auditLog.findMany({
    where: { actorId: { in: members.map((m) => m.userId) }, event },
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const entries = rows.slice(0, limit);
  const nextCursor =
    rows.length > limit ? entries[entries.length - 1].id : null;

  return NextResponse.json({ entries, nextCursor });
});
