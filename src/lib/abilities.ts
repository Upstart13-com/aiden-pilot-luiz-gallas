import "server-only";
import { defineAbilities } from "@upstart13-com/aiden-security";
import type { MembershipRole } from "@/generated/prisma/enums";
import type { MembershipContext } from "@/lib/membership";

const ORG_ACTIONS = [
  "ticket.read",
  "ticket.create",
  "ticket.update",
  "ticket.close",
  "ai.invoke",
  "org.members.manage",
  "org.audit.read",
  "org.usage.read",
] as const;

type OrgAction = (typeof ORG_ACTIONS)[number];

/**
 * Org-scoped ability matrix: which actions each membership role may perform.
 * Row visibility (which tickets) is enforced separately in `@/lib/tickets`.
 */
const ABILITY_MATRIX: Record<MembershipRole, readonly OrgAction[]> = {
  owner: [
    "ticket.read",
    "org.members.manage",
    "org.audit.read",
    "org.usage.read",
  ],
  agent: [
    "ticket.read",
    "ticket.create",
    "ticket.update",
    "ticket.close",
    "ai.invoke",
  ],
  viewer: ["ticket.read"],
};

type Actor = Pick<MembershipContext, "role">;

/**
 * `defineAbilities` passes each rule its resource as `unknown`. Routes pass the
 * caller's `MembershipContext`; this checks its `role` is one the matrix knows.
 */
function hasValidRole(resource: unknown): resource is Actor {
  return (
    typeof resource === "object" &&
    resource !== null &&
    "role" in resource &&
    typeof resource.role === "string" &&
    Object.hasOwn(ABILITY_MATRIX, resource.role)
  );
}

function canPerform(actor: Actor, action: OrgAction): boolean {
  return ABILITY_MATRIX[actor.role].includes(action);
}

export const abilities = defineAbilities({
  rules: {
    ...Object.fromEntries(
      ORG_ACTIONS.map((action) => [
        action,
        (_session, resource?: unknown) =>
          hasValidRole(resource) && canPerform(resource, action),
      ]),
    ),
  },
});
