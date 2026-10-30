/**
 * Seed the RBAC tables the starter ships with, plus Deskline's tenant
 * fixtures: two orgs with disjoint members, and tickets covering every
 * row-visibility branch in docs/plans/deskline.md §3.3.
 *
 * Run via `prisma db seed` (configured in package.json's `prisma` field).
 * Idempotent — every write is an upsert keyed on a natural or fixed id,
 * so re-running changes nothing.
 */

import dotenv from "dotenv";
import { hash } from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ROLES, PERMISSIONS } from "../src/config/rbac";

dotenv.config({ path: ".env.local" });

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

/**
 * Shared password for every seeded dev account, from SEED_PASSWORD in
 * .env.local. There is deliberately no default: a password committed to the
 * repo would be public for any database this seed ever ran against. Never
 * logged — it is hashed before it reaches the database.
 */
function requireSeedPassword(): string {
  const password = process.env.SEED_PASSWORD;
  if (!password) {
    throw new Error(
      "SEED_PASSWORD is not set. Add it to .env.local before seeding.",
    );
  }
  return password;
}

const SEED_PASSWORD = requireSeedPassword();

type SeedUser = {
  key: string;
  email: string;
  name: string;
  role: "owner" | "agent" | "viewer";
};

type SeedOrg = { slug: string; name: string; members: SeedUser[] };

/**
 * Two orgs with NO shared users. That disjointness is what makes the
 * cross-tenant 404 rows in §8.2 meaningful — a Globex member has no
 * legitimate path to an Acme row by any route.
 */
const ORGS: SeedOrg[] = [
  {
    slug: "acme",
    name: "Acme Support",
    members: [
      {
        key: "acmeOwner",
        email: "owner@acme.test",
        name: "Ada Owner",
        role: "owner",
      },
      {
        key: "acmeAgent",
        email: "agent@acme.test",
        name: "Alex Agent",
        role: "agent",
      },
      // A SECOND agent in the same org: proves "agent cannot touch another
      // agent's ticket" (404) is distinct from the cross-tenant case.
      {
        key: "acmeAgent2",
        email: "agent2@acme.test",
        name: "Avery Agent",
        role: "agent",
      },
      {
        key: "acmeViewer",
        email: "viewer@acme.test",
        name: "Val Viewer",
        role: "viewer",
      },
    ],
  },
  {
    slug: "globex",
    name: "Globex Support",
    members: [
      {
        key: "globexOwner",
        email: "owner@globex.test",
        name: "Gail Owner",
        role: "owner",
      },
      {
        key: "globexAgent",
        email: "agent@globex.test",
        name: "Gus Agent",
        role: "agent",
      },
    ],
  },
];

/**
 * Fixed ids keep the seed idempotent (tickets have no natural key) and
 * give the curl smoke suite stable ids to assert against.
 */
const TICKETS: {
  id: string;
  org: string;
  owner: string;
  assignee?: string;
  subject: string;
  body: string;
  status?: "open" | "pending" | "resolved" | "closed";
}[] = [
  // ── Acme ──────────────────────────────────────────────────────────────
  {
    id: "tkt_acme_agent_owned",
    org: "acme",
    owner: "acmeAgent",
    subject: "Card declined at checkout",
    body: "Customer reports their Visa is declined at the final step. Works on another site.",
  },
  {
    id: "tkt_acme_agent_assigned",
    org: "acme",
    owner: "acmeOwner",
    assignee: "acmeAgent",
    subject: "Export to CSV truncates long notes",
    body: "Notes over ~2000 characters are cut off in the exported file.",
    status: "pending",
  },
  {
    // Owned AND assigned to the OTHER agent — acmeAgent must get a 404.
    id: "tkt_acme_other_agent",
    org: "acme",
    owner: "acmeAgent2",
    assignee: "acmeAgent2",
    subject: "SSO login loops back to sign-in",
    body: "After authenticating with the IdP the user is returned to the login page.",
  },
  {
    id: "tkt_acme_owner_only",
    org: "acme",
    owner: "acmeOwner",
    subject: "Billing address will not save",
    body: "Saving a billing address returns a generic error with no field highlighted.",
    status: "resolved",
  },
  // ── Globex ────────────────────────────────────────────────────────────
  {
    id: "tkt_globex_agent_owned",
    org: "globex",
    owner: "globexAgent",
    subject: "Webhook retries are duplicated",
    body: "A single event is delivered three times within a minute.",
  },
  {
    id: "tkt_globex_agent_assigned",
    org: "globex",
    owner: "globexOwner",
    assignee: "globexAgent",
    subject: "Search returns stale results",
    body: "Newly created records take several minutes to appear in search.",
    status: "pending",
  },
  {
    id: "tkt_globex_owner_only",
    org: "globex",
    owner: "globexOwner",
    subject: "Invoice PDF missing tax line",
    body: "Generated invoices omit the VAT line for EU customers.",
  },
  {
    id: "tkt_globex_closed",
    org: "globex",
    owner: "globexAgent",
    assignee: "globexOwner",
    subject: "Password reset email never arrives",
    body: "Reset emails are not delivered to addresses on a corporate domain.",
    status: "closed",
  },
];

async function main(): Promise<void> {
  // ── AIDEN global RBAC tables (unchanged from the starter) ─────────────
  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      create: perm,
      update: { description: perm.description },
    });
  }

  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      create: {
        name: role.name,
        description: role.description,
        permissions: { connect: role.permissions.map((key) => ({ key })) },
      },
      update: {
        description: role.description,
        permissions: { set: role.permissions.map((key) => ({ key })) },
      },
    });
  }

  // ── Deskline tenants ──────────────────────────────────────────────────
  const passwordHash = await hash(SEED_PASSWORD, 12);
  const userIds = new Map<string, string>();

  for (const orgSpec of ORGS) {
    const org = await prisma.org.upsert({
      where: { slug: orgSpec.slug },
      create: { slug: orgSpec.slug, name: orgSpec.name },
      update: { name: orgSpec.name },
    });

    for (const member of orgSpec.members) {
      const user = await prisma.user.upsert({
        where: { email: member.email },
        create: { email: member.email, name: member.name, passwordHash },
        update: { name: member.name, passwordHash },
      });
      userIds.set(member.key, user.id);

      await prisma.membership.upsert({
        where: { userId_orgId: { userId: user.id, orgId: org.id } },
        create: { userId: user.id, orgId: org.id, role: member.role },
        update: { role: member.role },
      });
    }
  }

  // ── Tickets ───────────────────────────────────────────────────────────
  for (const t of TICKETS) {
    const org = await prisma.org.findUniqueOrThrow({ where: { slug: t.org } });
    const ownerId = userIds.get(t.owner);
    if (!ownerId) throw new Error(`seed: unknown owner key "${t.owner}"`);
    const assigneeId = t.assignee ? userIds.get(t.assignee) : null;
    if (t.assignee && !assigneeId) {
      throw new Error(`seed: unknown assignee key "${t.assignee}"`);
    }

    const data = {
      orgId: org.id,
      ownerId,
      assigneeId,
      subject: t.subject,
      body: t.body,
      status: t.status ?? "open",
      // Left untriaged on purpose: triage is Phase 4's job, and a null
      // triagedAt is what the UI renders as "Not triaged".
      closedAt: t.status === "closed" ? new Date() : null,
    } as const;

    await prisma.ticket.upsert({
      where: { id: t.id },
      create: { id: t.id, ...data },
      update: data,
    });
  }

  const [orgs, users, memberships, tickets] = await Promise.all([
    prisma.org.count(),
    prisma.user.count(),
    prisma.membership.count(),
    prisma.ticket.count(),
  ]);

  console.log(
    `✓ seeded roles + permissions; ${orgs} orgs, ${users} users, ` +
      `${memberships} memberships, ${tickets} tickets`,
  );
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
