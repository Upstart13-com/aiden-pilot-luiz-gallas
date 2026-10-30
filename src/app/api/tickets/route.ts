import { NextResponse } from "next/server";
import { withAuth, assertCan, RequestValidationError } from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { requireMembership } from "@/lib/membership";
import { ticketVisibilityWhere } from "@/lib/tickets";
import { prisma } from "@/lib/prisma";
import { ListTicketsQuery } from "@/lib/validation/ticket";

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
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const tickets = rows.slice(0, limit);
  const nextCursor =
    rows.length > limit ? tickets[tickets.length - 1].id : null;

  return NextResponse.json({ tickets, nextCursor });
});
