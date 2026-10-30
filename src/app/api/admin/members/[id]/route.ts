import { NextResponse } from "next/server";
import { OwnershipError } from "@upstart13-com/aiden-security";
import {
  withAuth,
  assertCan,
  auditLog,
  parseRequest,
  RequestValidationError,
} from "@/lib/security";
import { abilities } from "@/lib/abilities";
import { requireMembership } from "@/lib/membership";
import { prisma } from "@/lib/prisma";
import { RoleChangeBody } from "@/lib/validation/admin";
import { RouteParams } from "@/lib/validation/ticket";

type Params = Promise<{ id: string }>;

export const PATCH = withAuth<Params>(async (req, { session, params }) => {
  const parsed = RouteParams.safeParse(await params);
  if (!parsed.success) throw new RequestValidationError(parsed.error);
  const { id } = parsed.data;
  const { role } = await parseRequest(req, RoleChangeBody);

  const ctx = await requireMembership(session.user.id);
  assertCan(abilities, session, "org.members.manage", ctx);

  const member = await prisma.membership.findFirst({
    where: { id, orgId: ctx.orgId },
    select: { id: true, userId: true, role: true },
  });
  if (!member) throw new OwnershipError();

  if (member.userId === ctx.userId && role !== member.role) {
    return NextResponse.json(
      { error: "You can't change your own role." },
      { status: 400 },
    );
  }

  if (member.role === "owner" && role !== "owner") {
    const owners = await prisma.membership.count({
      where: { orgId: ctx.orgId, role: "owner" },
    });
    if (owners <= 1) {
      return NextResponse.json(
        { error: "An organization must keep at least one owner." },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.membership.update({
    where: { id: member.id },
    data: { role },
    select: { id: true, role: true },
  });
  auditLog({
    event: "member.role_changed",
    resourceId: updated.id,
    metadata: { orgId: ctx.orgId, from: member.role, to: role },
  });

  return NextResponse.json({ member: updated });
});
