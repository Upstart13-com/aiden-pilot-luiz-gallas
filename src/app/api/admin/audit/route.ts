import { NextResponse } from "next/server";
import { withAuth, assertCan, RequestValidationError } from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { listAuditEntries, listAuditEvents } from "@/lib/admin";
import { requireMembership } from "@/lib/membership";
import { AuditQuery } from "@/lib/validation/admin";

export const GET = withAuth(async (req, { session }) => {
  const url = new URL(req.url);
  const parsed = AuditQuery.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) throw new RequestValidationError(parsed.error);

  const ctx = await requireMembership(session.user.id);
  assertCan(abilities, session, "org.audit.read", ctx);

  const [page, events] = await Promise.all([
    listAuditEntries(ctx.orgId, parsed.data),
    listAuditEvents(ctx.orgId),
  ]);
  return NextResponse.json({ ...page, events });
});
