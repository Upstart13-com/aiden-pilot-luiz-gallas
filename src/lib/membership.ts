import "server-only";
import { OwnershipError } from "@upstart13-com/aiden-security";
import type { MembershipRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

/**
 * The caller's tenant and their role inside it. Every org-scoped route
 * resolves this once and threads it through: the `orgId` goes into the
 * WHERE clause, the `role` into `assertCan`.
 *
 * It is deliberately NOT read from `session.user.roles` — that array is
 * populated by aiden-auth from the app-wide `Role[]` many-to-many, so a
 * role granted there would apply in every tenant. See
 * docs/plans/deskline.md §1.1 (D1).
 */
export type MembershipContext = {
  userId: string;
  orgId: string;
  role: MembershipRole;
};

/**
 * Resolve the caller's org and role.
 *
 * Throws `OwnershipError` (404) when the user belongs to no org.
 *
 * v1 resolves a single membership per user (D4). This function is the only
 * place that assumption lives — lifting it to multi-org means reading an
 * active-org id here and verifying the caller holds a membership in it, and
 * changes nothing else. See docs/plans/deskline.md §1.2.
 */
export async function requireMembership(
  userId: string,
): Promise<MembershipContext> {
  const membership = await prisma.membership.findFirst({
    where: { userId },
    select: { orgId: true, role: true },
  });

  if (!membership) {
    throw new OwnershipError();
  }

  return { userId, orgId: membership.orgId, role: membership.role };
}
