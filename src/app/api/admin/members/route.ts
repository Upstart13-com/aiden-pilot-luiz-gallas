import { NextResponse } from "next/server";
import { withAuth, assertCan, auditLog, parseRequest } from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { listMembers } from "@/lib/admin";
import { requireMembership } from "@/lib/membership";
import { prisma } from "@/lib/prisma";
import { AddMemberBody } from "@/lib/validation/admin";

export const GET = withAuth(async (_req, { session }) => {
  const ctx = await requireMembership(session.user.id);
  assertCan(abilities, session, "org.members.manage", ctx);

  return NextResponse.json({ members: await listMembers(ctx.orgId) });
});

const refuse = (error: string) => NextResponse.json({ error }, { status: 400 });

/**
 * Adds an existing account to the caller's org. There are no email invites,
 * so the person must have registered first. One org per user (D4).
 */
export const POST = withAuth(async (req, { session }) => {
  const { email, role } = await parseRequest(req, AddMemberBody);

  const ctx = await requireMembership(session.user.id);
  assertCan(abilities, session, "org.members.manage", ctx);

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    return refuse(
      "No Deskline account uses that email. Ask them to register first.",
    );
  }

  const existing = await prisma.membership.findFirst({
    where: { userId: user.id },
    select: { orgId: true },
  });
  if (existing) {
    // Don't reveal which org: only whether it's this one.
    return refuse(
      existing.orgId === ctx.orgId
        ? "That person is already a member of your organization."
        : "That account already belongs to another organization.",
    );
  }

  const membership = await prisma.membership.create({
    data: { userId: user.id, orgId: ctx.orgId, role },
    select: { id: true, role: true, createdAt: true },
  });
  auditLog({
    event: "member.added",
    resourceId: membership.id,
    metadata: { orgId: ctx.orgId, role },
  });

  return NextResponse.json(
    {
      member: {
        id: membership.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        role: membership.role,
        createdAt: membership.createdAt,
      },
    },
    { status: 201 },
  );
});
