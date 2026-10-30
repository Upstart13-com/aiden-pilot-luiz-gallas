# Deskline — Implementation Plan

> **Status:** **Approved** 2026-10-29 — build not yet started.
> **Date:** 2026-10-29 (approved same day)
> **Author:** Claude Opus 5 (plan-then-build artefact)

Deskline is a multi-tenant SaaS support desk. Inside each customer org (a tenant), agents
triage and resolve customer tickets, assisted by an AI that drafts customer replies and
auto-classifies incoming tickets.

This plan covers **seven dimensions**:

| #   | Dimension              | Section                                             |
| --- | ---------------------- | --------------------------------------------------- |
| 1   | Domain & data model    | [§2](#2-dimension-1--domain--data-model)            |
| 2   | Security perimeter     | [§3](#3-dimension-2--security-perimeter)            |
| 3   | AI surface             | [§4](#4-dimension-3--ai-surface)                    |
| 4   | Observability & cost   | [§5](#5-dimension-4--observability--cost-telemetry) |
| 5   | UI / UX                | [§6](#6-dimension-5--ui--ux)                        |
| 6   | Bootstrap & ops        | [§7](#7-dimension-6--bootstrap--ops)                |
| 7   | Verification & grading | [§8](#8-dimension-7--verification--grading)         |

**Mapped to the capstone brief's seven dimensions** (added 2026-10-30, after checking the build
against the brief):

| Brief dimension   | Where                                                                               |
| ----------------- | ----------------------------------------------------------------------------------- |
| Outcome           | [§12.1](#121-outcome)                                                               |
| Data              | [§2](#2-dimension-1--domain--data-model)                                            |
| Permissions       | [§3.4](#34-abilities-srclibabilitiests), including the options rejected as unneeded |
| Request perimeter | [§3.2](#32-canonical-request-perimeter), [§3.7](#37-routes)                         |
| Audit             | [§12.2](#122-audit-events), [§5.1](#51-logging--audit-already-wired--extend-only)   |
| Files touched     | [§12.3](#123-files-touched)                                                         |
| Rollback          | [§12.4](#124-rollback)                                                              |

---

## 1. Decisions, scope boundaries and known gaps

### 1.1 Decisions taken (confirmed)

| #   | Decision                                                                                                                                                                                    | Rationale                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **RBAC via predicate rules + a resolved `Membership`.** Routes resolve the caller's membership first, then pass `{ role }` as the `resource` argument to `defineAbilities` predicate rules. | `aiden-auth` populates `session.user.roles` from the **global** `Role[]` many-to-many, not from per-org `Membership.role`. A `RoleRule` (`{ roles: [...] }`) would therefore grant a role across every tenant. Predicates keep the role per-org and always fresh (no stale JWT). |
| D2  | **Ticket keeps `ownerId`; ownership is projected at the call site** through a thin local assertion wrapper.                                                                                 | `assertOwnership` is hard-typed to `{ userId: string }` and reads `.userId` at runtime. Domain naming is preserved; see [§3.5](#35-the-assertownership-field-gap) for the wrapper that restores TypeScript narrowing.                                                            |
| D3  | **Default AI provider: Anthropic** (`@anthropic-ai/sdk`, `claude-haiku-4-5`).                                                                                                               | Supports both required surfaces — SSE streaming for Draft reply, and `responseSchema` for triage. Switchable with one line in `aiden.config.ts` ([§4.1](#41-provider-agnostic-wiring)).                                                                                          |
| D4  | **One active org per user in v1.** A user holds exactly one `Membership`, so "the caller's org" is unambiguous everywhere.                                                                  | Multi-org adds an active-org resolver, a switcher, and a stale-active-org failure mode to every route — none of which exercises tenant isolation any harder than two orgs with disjoint users already do. See [§1.2](#12-scope-boundary--one-active-org-per-user-d4).            |

### 1.2 Scope boundary — one active org per user (D4)

A user belongs to exactly **one** org in v1. This is a scope boundary, not a modelling
limitation: the schema is already shaped for multi-org, and only the resolver is narrowed.

**What this fixes:**

- `Membership` carries `@@unique([userId, orgId])` — the natural many-to-many shape. Nothing
  about the schema assumes a single membership, so **multi-org needs no migration**.
- `requireMembership()` resolves the caller's single membership with
  `findFirst({ where: { userId } })` and is the **only** place the assumption lives
  ([§3.6](#36-membership-resolver-srclibmembershipts)).
- The seed gives every user exactly one membership, across two orgs with disjoint users
  ([§2.7](#27-seed-prismaseedts)).

**What it does not weaken.** Tenant isolation is enforced by the `orgId` in every `where`
clause and by `orgId` being absent from every Zod schema
([§3.8](#38-zod-schemas-srclibvalidationticketts)) — neither depends on how many orgs a user
may belong to. The cross-tenant 404 matrix ([§8.2](#82-security-smoke-suite)) is unaffected.

**Upgrade path to multi-org.** Change `requireMembership()` to read an active-org id (cookie
or path segment), verify the caller holds a membership in it, and add an org switcher to the
dashboard header. No route, schema, ability rule, or smoke row changes — every route already
takes its `orgId` from the resolver rather than deriving it independently. Keeping that
single choke point is the reason the resolver is a function rather than an inlined query.

### 1.3 Known gaps in the AIDEN SDK (to raise upstream, per CLAUDE.md)

These are real limitations found by reading the installed packages. Each has an interim
approach so the build is not blocked, and each should be filed so the fix ships to every
app via `npx aiden upgrade`.

| #   | Gap                                                                                                                                                                                                                                                                                                                                                                                                                                           | Interim approach                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G1  | `assertOwnership<T extends { userId: string }>` hard-codes the owner field name. No `{ field }` option.                                                                                                                                                                                                                                                                                                                                       | Local assertion wrapper `assertTicketOwner` that delegates to `assertOwnership` ([§3.5](#35-the-assertownership-field-gap)). **Proposed SDK fix:** `assertOwnership(row, userId, { field?: keyof T })`.                                                                                                                                                                                                |
| G2  | `AuditListFilters` exposes only `userId` / `event` / `from` / `to` — **no tenant filter** — and `AuditLog` has no `orgId` column. An org-scoped audit viewer is impossible through `auditReader`.                                                                                                                                                                                                                                             | Read `prisma.auditLog` directly with `actorId: { in: memberIds }` ([§5.3](#53-org-scoped-audit-trail)). **Proposed SDK fix:** add `actorIds?: string[]` to `AuditListFilters`, and/or an optional `tenantId` column on the shipped fragment.                                                                                                                                                           |
| G3  | `AIUsageRecord` is a closed shape (`provider, model, *Tokens, costUSD, latencyMs, requestId?, userId?`). No passthrough for app metadata, so the sink cannot know the `orgId` or which feature spent the money.                                                                                                                                                                                                                               | `AsyncLocalStorage` call-context set by a `withAICall()` wrapper; the sink reads it ([§5.2](#52-ai-cost-telemetry)). **Proposed SDK fix:** `recordAIUsage({ ..., metadata?: Record<string, unknown> })`.                                                                                                                                                                                               |
| G4  | CLAUDE.md mandates invoking the **`/frontend-design` skill** before any UI code, but **no such command exists** in `.claude/commands/` (present: `security-review`, `create-prd-tasks`, `review-fixes`, `validate`, `ship`, `create-feature`). Nothing in the repo defines what the skill would do.                                                                                                                                           | **Resolved — no skill is authored.** The available documentation is the authority: CLAUDE.md's Pre-Flight table plus `docs/design-system/*`. §6.1 turns those into the explicit, repeatable pre-flight the skill would have encoded, and that read is the binding gate. **Raise upstream:** correct the CLAUDE.md reference, or ship the skill in the starter so the step is reproducible across apps. |
| G5  | `/api/dev/impersonate` is a no-op stub — it validates a role and echoes it back without mutating the session. It cannot be used to switch personas in a test harness.                                                                                                                                                                                                                                                                         | The security smoke suite authenticates each persona for real through the credentials provider and keeps a cookie jar per persona ([§8.2](#82-security-smoke-suite)).                                                                                                                                                                                                                                   |
| G6  | **`.claude/hooks/check-design-system.sh` Rule 2 contradicts the design system.** The hook is live (PostToolUse on Edit/Write) and blocks the `rounded-lg` / `xl` / `2xl` / `3xl` scale with "Only avatars get rounded-full" — but CLAUDE.md:103 and `00-overview.md`:31 **mandate** `rounded-lg` for buttons/badges, `rounded-xl` for cards and `rounded-2xl` for modals. Every DS-correct Card, Button and Dialog would be blocked on write. | Narrow Rule 2 to what the DS actually forbids — radii **above** `rounded-2xl` (`rounded-3xl` and arbitrary values) — as the first step of **Phase 8**, before any UI code. One regex. Hook Rules 1 and 3 are correct and stay.                                                                                                                                                                         |

### 1.4 Pre-existing breakage — OUT OF SCOPE

> **Phase 0 was removed from this build on 2026-10-30.** Repairing pre-existing breakage is
> no longer part of this work. The faults below remain in the tree and are tracked, not fixed.

`npx tsc --noEmit` fails with **7 errors** on a clean tree. They predate this work:

```
src/app/(marketing)/layout.tsx(20,9): TS4104  readonly [] not assignable to SiteFooterLink[]
src/lib/ai.ts(19,35)  TS2339  Property 'model' does not exist on type 'false'   (x6, one per provider)
```

Cause (corroborated by `.claude/progress.log`, 2026-10-29 14:28 / 14:42): `aiden.config.ts`
was reshaped so `ai.providers.<name>` is a **boolean** (to satisfy the `aiden-cli` 2.0.1
config schema), but the companion `ai.models` map was never added and `src/lib/ai.ts` still
reads `providerModels.<name>.model`.

**Consequence for this build — read before trusting any green check:**

1. **`tsc` is not a clean signal.** The gate becomes _no **new** errors beyond these 7_
   ([§8.1](#81-per-change-validation)). A regression introduced by this work is detected by
   the count changing, not by the suite being empty. This is strictly weaker than a clean
   baseline and is the direct cost of dropping Phase 0.
2. **The six `src/lib/ai.ts` errors sit on the critical path of Phase 4.** `defaultAI()`
   ([§4.1](#41-provider-agnostic-wiring)) cannot resolve a model until `ai.models` exists.
   That one repair is therefore **pulled into Phase 4** as a prerequisite, scoped to exactly
   what the AI surface needs — not as general cleanup.
3. **The `(marketing)/layout.tsx` error is untouched.** Nothing in this build imports it, so
   it stays as found and stays in the count of 7.

### 1.5 Deviations during build

| #    | Phase   | Deviation                                                                                                                                                                                                                                                                                                                                                                    |
| ---- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DV1  | 2       | **Abilities are a role → action matrix** following the persona table ([§3.4](#34-abilities-srclibabilitiests)). Owners read every ticket and manage members, audit and usage, but do **not** create, update or close tickets or invoke AI (403).                                                                                                                             |
| DV2  | 2       | **The starter's global `audit.read` / `audit.export` / `users.manage` rules are removed.** The starter `/admin` pages and admin API routes deny every request until Phase 7 replaces them.                                                                                                                                                                                   |
| DV3  | 2       | **No org membership → 404, not 403.** Every denial outside role capability is a 404, with no exception ([§3.6](#36-membership-resolver-srclibmembershipts)).                                                                                                                                                                                                                 |
| DV4  | 2–8     | **Ticket visibility moved into the query** (`findVisibleTicket`), confirmed by `assertOwnership` on the result; the earlier `assertTicketVisible`/`assertTicketOwner` wrappers and their inline id comparison are gone ([§3.2](#32-canonical-request-perimeter)).                                                                                                            |
| DV5  | 4–6     | **AI hardening:** ticket text is JSON-fenced in the user message and both system prompts forbid following it or revealing instructions; per-route `maxTokens`; creating or editing ticket content also requires `ai.invoke`; one shared AI client; the starter's ungated `/api/ai/chat` route and chat page are removed.                                                     |
| DV6  | 8       | **Pages never touch the database.** Server-rendered pages read through the app's own API routes, so every read crosses the same perimeter as the browser's requests.                                                                                                                                                                                                         |
| DV8  | 3, 6, 7 | **Perimeter order corrected (2026-10-30).** `PATCH`/`close`/`draft` and the member role change called `assertCan` before the scoped read, so a viewer got **403** for another org's ticket. The org-filtered read + `assertOwnership` now run first and `assertCan` after, matching the brief's order; smoke rows 25–30 cover it ([§3.2](#32-canonical-request-perimeter)).  |
| DV9  | 1, 5    | **Naming differs from the brief:** fragments are `org.prisma` (Org + Membership), `ticket.prisma`, `ai-usage.prisma`; `AIUsage` records the call as `feature` (`ticket.draft` / `ticket.triage`) where the brief says `route`, and adds `provider`, `requestId`, `totalTokens`, `latencyMs`. `Membership.role` and the ticket fields are Postgres enums rather than strings. |
| DV10 | 5       | **Audit aligned with the brief (2026-10-30):** events renamed to `ticket.create`, `ticket.update`, `ticket.close`, `ai.draft`, `member.role_change` (+ `member.add`); `ai.classify` added after a successful triage; a second, file-based audit sink selectable with `audit.sink` in `aiden.config.ts` ([§12.2](#122-audit-events)).                                         |
| DV11 | 8       | **Ticket detail uses `PageHeader`** (breadcrumb moved below it); the draft panel uses `useAIStream`'s `reset` for a **Discard** action.                                                                                                                                                                                                                                      |
| DV7  | 1       | **Relation hygiene:** every FK to `User` and `Org` cascades on delete; `Ticket` gains `@@index([orgId])`, `@@index([ownerId])` and `@@index([assigneeId])`, and `AIUsage` gains `@@index([userId])`.                                                                                                                                                                         |

## 2. Dimension 1 — Domain & data model

### 2.1 Frozen resource family

Exactly five record types. **No other resources.**

| Model        | Origin                                         | Purpose                                              |
| ------------ | ---------------------------------------------- | ---------------------------------------------------- |
| `Org`        | new fragment                                   | The tenant.                                          |
| `Membership` | new fragment                                   | Joins `User` ↔ `Org`, carries the org-scoped `role`. |
| `Ticket`     | new fragment                                   | The support ticket; carries `orgId` + `ownerId`.     |
| `AuditLog`   | AIDEN-shipped (`aiden-db/schema/audit.prisma`) | Audit trail. Not redefined.                          |
| `AIUsage`    | new fragment                                   | Per-call token / cost telemetry.                     |

### 2.2 Fragment layout

Schema changes go in **fragments only**. `prisma/schema.prisma` is composed by
`aiden-db-merge-schema` and must never be hand-edited.

```
prisma/fragments/
├── _base.prisma      # existing — datasource + generator
├── user.prisma       # EDIT — add back-relations
├── org.prisma        # NEW — Org, Membership, MembershipRole
├── ticket.prisma     # NEW — Ticket + status/priority/sentiment enums
└── ai-usage.prisma   # NEW — AIUsage
```

### 2.3 `user.prisma` — back-relations to add

Prisma requires the consumer-owned `User` to declare every back-relation it participates in.
Append to the existing model (leave the AIDEN-required `accounts` / `sessions` / `roles` lines
untouched):

```prisma
  memberships     Membership[]
  ticketsOwned    Ticket[]     @relation("TicketOwner")
  ticketsAssigned Ticket[]     @relation("TicketAssignee")
```

### 2.4 `org.prisma`

```prisma
enum MembershipRole {
  owner
  agent
  viewer
}

model Org {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  memberships Membership[]
  tickets     Ticket[]
  aiUsage     AIUsage[]

  @@map("orgs")
}

model Membership {
  id        String         @id @default(cuid())
  userId    String         @map("user_id")
  orgId     String         @map("org_id")
  role      MembershipRole @default(viewer)
  createdAt DateTime       @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  org  Org  @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@unique([userId, orgId])
  @@index([orgId])
  @@map("memberships")
}
```

Exactly three roles, as a Postgres enum — the database itself rejects a fourth. This is the
cheapest possible enforcement of the "no more than three roles" constraint.

### 2.5 `ticket.prisma`

```prisma
enum TicketStatus {
  open
  pending
  resolved
  closed
}

enum TicketPriority {
  low
  medium
  high
  urgent
}

enum TicketSentiment {
  positive
  neutral
  negative
}

model Ticket {
  id         String           @id @default(cuid())
  orgId      String           @map("org_id")
  ownerId    String           @map("owner_id")
  assigneeId String?          @map("assignee_id")

  subject    String
  body       String           @db.Text
  status     TicketStatus     @default(open)

  // AI triage output — written by ai.complete({ responseSchema }).
  priority   TicketPriority   @default(medium)
  category   String?
  sentiment  TicketSentiment?
  triagedAt  DateTime?        @map("triaged_at")

  closedAt   DateTime?        @map("closed_at")
  createdAt  DateTime         @default(now()) @map("created_at")
  updatedAt  DateTime         @updatedAt @map("updated_at")

  org      Org   @relation(fields: [orgId], references: [id], onDelete: Cascade)
  owner    User  @relation("TicketOwner", fields: [ownerId], references: [id])
  assignee User? @relation("TicketAssignee", fields: [assigneeId], references: [id])

  @@index([orgId, status])
  @@index([orgId, ownerId])
  @@index([orgId, assigneeId])
  @@map("tickets")
}
```

Every index is **compound on `orgId` first** — tenant isolation is an index-level property, not
just a `where`-clause convention.

### 2.6 `ai-usage.prisma`

```prisma
model AIUsage {
  id        String   @id @default(cuid())
  orgId     String?  @map("org_id")
  userId    String?  @map("user_id")
  requestId String?  @map("request_id")
  /// "ticket.draft" | "ticket.triage" — which feature spent the money.
  feature   String?

  provider         String
  model            String
  promptTokens     Int      @map("prompt_tokens")
  completionTokens Int      @map("completion_tokens")
  totalTokens      Int      @map("total_tokens")
  costUSD          Decimal  @map("cost_usd") @db.Decimal(12, 6)
  latencyMs        Int      @map("latency_ms")
  createdAt        DateTime @default(now()) @map("created_at")

  org Org? @relation(fields: [orgId], references: [id], onDelete: SetNull)

  @@index([orgId, createdAt])
  @@map("ai_usage")
}
```

`costUSD` is `Decimal(12,6)`, not `Float` — summing float money across thousands of calls
drifts. `orgId` / `userId` are nullable so a usage row survives a deleted org and so the sink
never throws when it fires outside a request context.

### 2.7 Seed (`prisma/seed.ts`)

Extend the existing idempotent seed (keep its current role/permission upsert for the AIDEN
global RBAC tables, which `aiden-auth` still reads).

**Two orgs with disjoint users** — this is what makes cross-tenant 404s demonstrable:

| Org            | Slug     | Users                                                                             |
| -------------- | -------- | --------------------------------------------------------------------------------- |
| Acme Support   | `acme`   | `owner@acme.test` (owner), `agent@acme.test` (agent), `viewer@acme.test` (viewer) |
| Globex Support | `globex` | `owner@globex.test` (owner), `agent@globex.test` (agent)                          |

Plus a second Acme agent, `agent2@acme.test`, so "agent cannot touch **another agent's**
ticket **within the same org**" (404) is testable and distinct from the cross-tenant case.

Tickets: ~4 per org, with a mix of `ownerId` / `assigneeId` so every row-visibility branch has
a fixture. All seeded passwords are a single shared dev constant hashed with bcryptjs cost 12,
recorded in `.env.example` — never printed to the console and never a real credential.

### 2.8 Migration

```bash
npm run prisma:merge      # fragments → prisma/schema.prisma
npm run db:migrate        # prisma migrate dev --name deskline_core
npm run db:seed
```

---

## 3. Dimension 2 — Security perimeter

### 3.1 The two-axis model

Deskline's access rules fall on two axes, and they produce **different status codes**. Getting
this wrong is the single most likely defect, so it is stated before any code:

| Axis           | Question                                              | Failure | Mechanism                                         |
| -------------- | ----------------------------------------------------- | ------- | ------------------------------------------------- |
| **Capability** | Is this _role_ allowed to perform this _verb_ at all? | **403** | `assertCan` → `AbilityError` (status 403)         |
| **Visibility** | Is this _row_ one this caller may see at all?         | **404** | `assertOwnership` → `OwnershipError` (status 404) |

A viewer attempting a mutation is a _capability_ failure — they are a legitimate member of the
tenant, so telling them "forbidden" leaks nothing: **403**.

Any attempt to reach a row outside the caller's visibility — another org's ticket, or (for an
agent) another agent's ticket — is a _visibility_ failure and must be **404**, so "doesn't
exist" and "not yours" are indistinguishable. **Cross-tenant access is always 404, never 403.**

### 3.2 Canonical request perimeter

Every `src/app/api/**/route.ts` runs these steps in this order. No step may be reordered or
skipped.

```ts
export const PATCH = withAuth<RouteParams>(async (req, { session, params }) => {
  // 1. withAuth            → 401 if unauthenticated (wrapper, already applied)
  const { id } = await params;

  // 2. parseRequest        → 400 on an invalid body (Zod)
  const body = await parseRequest(req, UpdateTicketBody);

  // 3. requireMembership   → 404 if the caller belongs to no org
  const ctx = await requireMembership(session.user.id);

  // 4. scoped query        → org (and, for agents, own/assigned) in the WHERE clause
  // 5. assertOwnership     → no row becomes a 404 + security.ownership_failed
  const ticket = await findVisibleTicket(id, ctx);

  // 6. assertCan           → 403 if this ROLE may not perform this VERB
  //    After the read (DV8): another org's ticket is a 404 for every role.
  assertCan(abilities, session, "ticket.update", ctx);

  // 7. mutate + audit
  const updated = await prisma.ticket.update({ where: { id: ticket.id }, data: { ... } });
  auditLog({ event: "ticket.update", resourceId: updated.id, metadata: { orgId } });

  // 8. respond
  return NextResponse.json({ ticket: updated });
});
```

Steps 4 and 5 together are the IDOR guard, and they are a deliberate **two-step**:

1. **Tenant scoping is enforced at the query level.** `findVisibleTicket` adds
   `ticketVisibilityWhere(ctx)` to the lookup — the caller's `orgId`, plus own-or-assigned for
   agents. A cross-tenant id, or another agent's ticket, simply matches no row. No code ever
   compares ids after the fact.
2. **`assertOwnership` confirms it.** The curriculum's signature is
   `assertOwnership(row, userId)`, and a missing row is exactly what it turns into a 404 (plus
   the SDK's `security.ownership_failed` audit event). Because step 1 already removed every row
   the caller may not see, "doesn't exist" and "not yours" reach the same 404.

The list route uses the same `ticketVisibilityWhere`, so lists and single-ticket lookups can't
disagree. Every route calls `withAuth`; the only exception would be webhooks, and Deskline
has none in core scope.

### 3.3 Row visibility matrix

| Role     | Reads                                        | Mutates                |
| -------- | -------------------------------------------- | ---------------------- |
| `owner`  | Every ticket in their org                    | **Nothing** (403, DV1) |
| `agent`  | Only tickets they own **or** are assigned to | Same                   |
| `viewer` | Every ticket in their org                    | **Nothing** (403)      |

Implemented once, in `src/lib/tickets.ts`, so no route re-derives it:

```ts
/** The WHERE fragment that scopes a list query to what this caller may see. */
export function ticketVisibilityWhere(ctx: MembershipContext) {
  if (ctx.role === "agent") {
    return {
      orgId: ctx.orgId,
      OR: [{ ownerId: ctx.userId }, { assigneeId: ctx.userId }],
    };
  }
  return { orgId: ctx.orgId }; // owner + viewer see the whole org
}
```

The agent restriction lives in the **`where` clause**, not in a post-fetch filter — an agent's
list query never loads another agent's rows into memory in the first place.

### 3.4 Abilities (`src/lib/abilities.ts`)

Org rules are generated from a single role → action matrix (DV1). Routes pass the caller's
resolved membership as the `resource` argument (D1); anything without a known `role` is denied.

```ts
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

function hasValidRole(resource: unknown): resource is Actor {
  /* role is a matrix key */
}

function canPerform(actor: Actor, action: OrgAction): boolean {
  return ABILITY_MATRIX[actor.role].includes(action);
}

export const abilities = defineAbilities({
  rules: Object.fromEntries(
    ORG_ACTIONS.map((action) => [
      action,
      (_session, resource?: unknown) =>
        hasValidRole(resource) && canPerform(resource, action),
    ]),
  ),
});
```

Note what is **not** here: no CASL conditions, no fourth role, no per-field rules. Eight
actions, three roles, two predicate shapes.

**Options rejected as unneeded** — the simplest primitive that answers each question:

| Option                                                      | Why it was declined                                                                                                                                                    |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CASL conditions (`{ ownerId: user.id }` on `ticket.update`) | Row visibility already lives in the query (§3.2), and `assertOwnership` turns "no row" into a 404. A condition would answer the same question a second time, as a 403. |
| A per-ticket `ticket.update.own` ability for agents         | Same reason: "own or assigned" is a `WHERE` clause, not a capability.                                                                                                  |
| An owner `ticket.update` / `ai.invoke` ability              | The persona table gives owners governance, not ticket work, so owners read tickets but don't change them or call AI.                                                   |
| The starter's global `Role` / `Permission` RBAC tables      | They are app-wide; Deskline's roles are per org, on `Membership.role` (DV2).                                                                                           |
| A fourth role (e.g. `admin` separate from `owner`)          | The brief fixes three roles.                                                                                                                                           |

### 3.5 The `assertOwnership` field gap

`assertOwnership` is hard-typed to a `userId` field, while a Ticket names its owner `ownerId`
(D2), and agents may also see tickets assigned to them. So ownership is not checked by
comparing fields on the row: the visibility rule lives in the query (§3.2, step 1), and
`assertOwnership` is called on the result of that scoped query, where "no row" is the only
failure left. This keeps every 404 coming from `OwnershipError` inside `aiden-security`. Gap
**G1** is still worth raising upstream.

### 3.6 Membership resolver (`src/lib/membership.ts`)

```ts
import "server-only";
import { OwnershipError } from "@upstart13-com/aiden-security";
import { prisma } from "@/lib/prisma";

export type MembershipContext = {
  userId: string;
  orgId: string;
  role: MembershipRole;
};

/** Resolve the caller's org + role. Throws OwnershipError (404) if they belong to no org. */
export async function requireMembership(
  userId: string,
): Promise<MembershipContext> {
  const m = await prisma.membership.findFirst({
    where: { userId },
    select: { orgId: true, role: true },
  });
  if (!m) throw new OwnershipError();
  return { userId, orgId: m.orgId, role: m.role };
}
```

A user with no membership gets **404**, like every other denial outside role capability
(DV3). This is the single function that would change if the one-org-per-user scope boundary
(**D4**, [§1.2](#12-scope-boundary--one-active-org-per-user-d4)) is ever lifted.

### 3.7 Routes

Ten routes. `RouteParams = Promise<{ id: string }>` throughout, per the `withAuth<P>` signature.

| Method  | Path                      | Zod schema         | Checks                                        | Notes                                                |
| ------- | ------------------------- | ------------------ | --------------------------------------------- | ---------------------------------------------------- |
| `GET`   | `/api/tickets`            | `ListTicketsQuery` | `withAuth` + org-filter                       | List, org-scoped; agent rows narrowed in the `where` |
| `POST`  | `/api/tickets`            | `CreateTicketBody` | `withAuth` + `parseRequest` + `assertCan`     | Fires `ai.classify` triage                           |
| `GET`   | `/api/tickets/[id]`       | `RouteParams`      | `withAuth` + org-filter + `assertOwnership`   |                                                      |
| `PATCH` | `/api/tickets/[id]`       | `UpdateTicketBody` | full perimeter + `assertCan`                  | May re-classify                                      |
| `POST`  | `/api/tickets/[id]/close` | `RouteParams`      | full perimeter + `assertCan`                  |                                                      |
| `POST`  | `/api/tickets/[id]/draft` | `DraftBody`        | full perimeter + `assertCan`                  | **SSE** stream                                       |
| `GET`   | `/api/admin/members`      | —                  | `withAuth` + `assertCan` (owner)              |                                                      |
| `PATCH` | `/api/admin/members/[id]` | `RoleChangeBody`   | full perimeter + `assertCan` (owner)          | Role change                                          |
| `GET`   | `/api/admin/audit`        | —                  | `withAuth` + `assertCan` (owner) + org-filter | `AuditLog` viewer                                    |
| `GET`   | `/api/admin/usage`        | —                  | `withAuth` + `assertCan` (owner) + org-filter | `AIUsage` spend                                      |

`GET` routes take **no body**, so `parseRequest` (which calls `req.json()`) does not apply —
query strings are validated with `ListTicketsQuery.safeParse(Object.fromEntries(url.searchParams))`,
which CLAUDE.md permits explicitly.

The starter's `/api/admin/users` is **replaced** by `/api/admin/members` (org-scoped); the
starter's `/api/admin/audit` is **reworked** from the global `auditReader` to the org-scoped
read in [§5.3](#53-org-scoped-audit-trail).

### 3.8 Zod schemas (`src/lib/validation/ticket.ts`)

```ts
export const CreateTicketBody = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10_000),
  assigneeId: z.string().cuid().optional(),
});

export const UpdateTicketBody = z
  .object({
    subject: z.string().min(1).max(200).optional(),
    body: z.string().min(1).max(10_000).optional(),
    status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
    assigneeId: z.string().cuid().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, "At least one field is required");

export const ListTicketsQuery = z.object({
  status: z.enum(["open", "pending", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const DraftBody = z.object({
  tone: z.enum(["neutral", "apologetic", "concise"]).default("neutral"),
});

export const RoleChangeBody = z.object({
  role: z.enum(["owner", "agent", "viewer"]),
});
```

`orgId` is **never** accepted from the client in any schema — it is always derived from the
session's membership. This is the structural reason cross-tenant writes are impossible, not
merely unauthorized.

### 3.9 Additional hardening

- **`src/middleware.ts`** — mount `securityHeaders` from `@upstart13-com/aiden-security/middleware`
  (HSTS, X-Frame-Options, CSP). Not currently present in the repo.
- **Rate limiting** — both AI routes wrap `withRateLimit` keyed on `session.user.id`, matching
  the pattern already in `src/app/api/ai/chat/route.ts`, so one account cannot drive unbounded
  provider spend.
- **Last-owner guard** — `PATCH /api/admin/members/[id]` refuses to demote the org's final
  `owner` (400 with a specific message), and refuses self-demotion. Without this an org can be
  permanently locked out of its own admin surface.

---

## 4. Dimension 3 — AI surface

Exactly **two** AI capabilities. Anything further — thread summarisation, a tool-using agentic
loop — is explicitly out of scope.

### 4.1 Provider-agnostic wiring

`src/lib/ai.ts` already exposes lazy per-provider factories over `createAIClient`, but it
reads a `.model` field that `aiden.config.ts` no longer has. **Phase 4 repairs it** to read an
`ai.models` map — Phase 0 is out of scope, so this repair now rides with the first feature that
needs it (see [§1.4](#14-pre-existing-breakage--out-of-scope)).
Add a single default resolver so routes never name a provider:

```ts
// aiden.config.ts
ai: {
  /** The active provider. THIS is the one line that swaps vendors. */
  defaultProvider: "anthropic",
  providers: { openai: false, anthropic: true, google: false, mistral: false, groq: false, cohere: false },
  models: { anthropic: "claude-haiku-4-5", openai: "gpt-4o-mini", google: "gemini-2.5-flash" },
}
```

```ts
// src/lib/ai.ts
export const defaultAI = (): Promise<AIClient> =>
  ai[aidenConfig.ai.defaultProvider]();
```

Both AI routes call `defaultAI()`. **Switching providers live is one line** —
`defaultProvider: "openai"` plus the matching env var — with no route changes. Provider SDKs
are optional peer deps, so `npm install @anthropic-ai/sdk` is part of **Phase 4** — the first
phase that makes a real provider call — and nothing else is installed.

### 4.2 Feature 1 — Draft reply (SSE streaming)

`POST /api/tickets/[id]/draft`. The **only** streaming surface.

```ts
export const POST = withAuth<RouteParams>(
  withRateLimit<AuthHandlerContext<RouteParams>>(
    async (req, { session, params }) => {
      const { id } = await params;
      const { tone } = await parseRequest(req, DraftBody);
      const ctx = await requireMembership(session.user.id);

      assertCan(abilities, session, "ai.invoke", ctx); // viewer → 403

      const ticket = await prisma.ticket.findFirst({
        where: { id, orgId: ctx.orgId },
      });
      assertTicketVisible(ticket, ctx); // cross-tenant → 404

      const client = await defaultAI();
      const stream = await withAICall(
        { orgId: ctx.orgId, feature: "ticket.draft" },
        () =>
          client.stream({
            system: DRAFT_SYSTEM_PROMPT,
            messages: [
              { role: "user", content: renderTicketForDraft(ticket, tone) },
            ],
          }),
      );

      auditLog({
        event: "ai.draft",
        resourceId: ticket.id,
        metadata: { orgId: ctx.orgId, tone },
      });
      return createAIStreamResponse(stream, { signal: req.signal });
    },
    {
      limit: 10,
      windowMs: 60_000,
      keyFor: (_r, { session }) => session.user.id,
    },
  ),
);
```

**The full perimeter runs before a single token is generated.** The SSE response is the last
statement in the handler — an authorization failure is a plain JSON 403/404, never a stream
that opens and then errors.

No custom SSE encoder is written. `createAIStreamResponse` + `useAIStream` own the wire format
(`data: {"delta":...}` frames, terminal `event: done`, `event: error` on failure). `{ signal: req.signal }`
is passed so an aborted client stops provider billing.

### 4.3 Feature 2 — Triage classification (structured output)

The **only** `responseSchema` use. Fires on ticket create, and on update when `subject` or
`body` changed.

```ts
const TRIAGE_SCHEMA = {
  type: "object",
  properties: {
    priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
    category: { type: "string" },
    sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
  },
  required: ["priority", "category", "sentiment"],
} as const;

const TriageResult = z.object({
  priority: z.enum(["low", "medium", "high", "urgent"]),
  category: z.string().min(1).max(60),
  sentiment: z.enum(["positive", "neutral", "negative"]),
});
```

```ts
// src/lib/triage.ts
export async function classifyTicket(
  input: { subject: string; body: string },
  ctx: MembershipContext,
) {
  const client = await defaultAI();
  const res = await withAICall(
    { orgId: ctx.orgId, feature: "ticket.triage" },
    () =>
      client.complete({
        system: TRIAGE_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: `${input.subject}\n\n${input.body}` },
        ],
        responseSchema: TRIAGE_SCHEMA,
      }),
  );
  // The provider's JSON is untrusted input — re-validate before it reaches the DB.
  return TriageResult.safeParse(res.parsed);
}
```

Two deliberate choices:

1. **The model's output is re-validated with Zod before it is persisted.** `responseSchema`
   enforcement varies by provider (OpenAI uses strict `json_schema`; Anthropic merely
   _instructs_ the model to emit JSON), so a schema-shaped prompt is not a guarantee. The Zod
   parse is what actually protects the enum columns.
2. **Triage never fails the request.** On a provider error or a failed parse, the ticket is
   still created with its default `medium` priority and `triagedAt` left `null`; the failure is
   recorded via `log.error()` (never swallowed) and the UI shows "Not triaged". A flaky vendor
   must not block a customer filing a ticket.

Both calls run **after** the write commits, so a slow provider does not hold a DB transaction
open.

---

## 5. Dimension 4 — Observability & cost telemetry

### 5.1 Logging & audit (already wired — extend only)

`src/lib/logger.ts` (pino) and `src/lib/audit.ts` (Prisma audit sink, registered from
`src/instrumentation.ts`) are in place. `withAuth` runs every handler inside
`withRequestContext`, so `requestId` / `userId` auto-attach to every log line and audit record.

Events this build emits are listed in [§12.2](#122-audit-events). The SDK already emits
`security.ownership_failed` and `security.ability_denied` on every perimeter rejection — so the
**denial path is audited without any app code**, which is what makes the audit viewer a real
security artefact rather than a changelog.

Every app-emitted record carries `metadata: { orgId }` — both for the audit viewer's defensive
second filter and as the migration path if gap **G2** is fixed with a `tenantId` column.

### 5.2 AI cost telemetry

`aiden-ai` calls `recordAIUsage()` on every successful completion **and** on
`finalResponse()` of a stream (so partial reads still bill correctly). The app swaps the sink
for a Prisma writer.

The obstacle is gap **G3**: `AIUsageRecord` is closed, so the sink receives `userId` and
`requestId` but has no way to learn the `orgId` or the feature. An `AsyncLocalStorage`
call-context bridges it:

```ts
// src/lib/ai-usage.ts
import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { setAIUsageSink } from "@upstart13-com/aiden-logging";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

type AICallMeta = { orgId: string; feature: "ticket.draft" | "ticket.triage" };
const aiCallContext = new AsyncLocalStorage<AICallMeta>();

/** Tag every recordAIUsage() fired inside `fn` with the org + feature. */
export function withAICall<T>(
  meta: AICallMeta,
  fn: () => Promise<T>,
): Promise<T> {
  return aiCallContext.run(meta, fn);
}

setAIUsageSink(async (record) => {
  const meta = aiCallContext.getStore();
  try {
    await prisma.aIUsage.create({
      data: { ...record, orgId: meta?.orgId, feature: meta?.feature },
    });
  } catch (err) {
    // Never let telemetry fail a user request — but never swallow it silently either.
    log.error({ err, record }, "failed to persist AI usage");
  }
});
```

Registered once from `src/instrumentation.ts`, alongside the existing audit sink.

`AsyncLocalStorage` survives the `await` boundaries inside the provider adapter, so a streamed
call's `finalResponse()` — which fires long after the handler returned its Response — still
resolves the right org. This is the reason for a context rather than a parameter.

### 5.3 Org-scoped audit trail

Gap **G2** means `auditReader` cannot filter by tenant. The owner-only viewer therefore reads
`prisma.auditLog` directly:

```ts
const memberIds = (
  await prisma.membership.findMany({
    where: { orgId: ctx.orgId },
    select: { userId: true },
  })
).map((m) => m.userId);

const entries = await prisma.auditLog.findMany({
  where: { actorId: { in: memberIds } },
  orderBy: [{ timestamp: "desc" }, { id: "desc" }],
  take: limit + 1,
});
```

`AuditLog.actorId` is indexed by the shipped fragment, so this stays a single indexed query.
This is a **read against a table the SDK owns**, not a reimplementation of the audit
subsystem — the sink, the record shape, and the write path remain entirely the SDK's.

### 5.4 Cost view

`GET /api/admin/usage` aggregates `AIUsage` for the caller's org:

- `_sum.costUSD`, `_sum.totalTokens`, `_count` — all-time and last-30-days
- `groupBy: ["feature"]` — Draft reply vs triage spend split
- `groupBy: ["model"]` — spend per model
- The 20 most recent calls, for the detail table

Every query carries `where: { orgId: ctx.orgId }`. Cost is as tenant-scoped as ticket data.

---

## 6. Dimension 5 — UI / UX

### 6.1 Mandatory pre-flight

CLAUDE.md requires the `frontend-design` skill before any UI code. **That skill does not
exist** in this repo (gap **G4**) and nothing defines what it would do, so this plan does not
invent one. Instead the pattern is established from the documentation that _is_ available —
CLAUDE.md's Pre-Flight table and `docs/design-system/*` — and **that read is the binding
gate**. If the skill ships later it should encode exactly this procedure.

**The procedure, run once per UI surface before writing it:**

1. **Read `docs/design-system/00-overview.md`.** Always, for every UI task — it carries the
   golden rules, the token vocabulary and the anti-pattern table. _(Done for this plan.)_
2. **Read the DS file(s) for the specific component type** being built, per the table below.
   Read only those — CLAUDE.md's Context Management section forbids pulling all nine files.
3. **Read the API route that serves the surface** before writing its fetch, and match the
   response envelope exactly ([§6.8](#68-read-the-api-route-before-writing-the-fetch)).
4. **Write the surface**, then verify against `00-overview.md`'s anti-pattern table.
5. **Check light and dark, at mobile / tablet / desktop**, before the surface is called done.

**Which file each Phase 8 surface requires:**

| Surface                    | DS files to read first                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Ticket list (`/dashboard`) | `08-page-layouts.md` (dashboard page), `05-data-display.md` (table, metric cards, empty states), `02-components.md` (status/priority badges) |
| Ticket detail              | `08-page-layouts.md` (detail page + breadcrumb), `02-components.md` (tabs), `07-feedback.md` (streaming + error states)                      |
| New-ticket form            | `03-forms.md`                                                                                                                                |
| Close confirmation         | `04-dialogs.md`                                                                                                                              |
| Admin members              | `05-data-display.md` (table), `03-forms.md` (role select), `04-dialogs.md` (demotion confirm)                                                |
| Admin audit                | `05-data-display.md` (table, empty state)                                                                                                    |
| Admin cost                 | `05-data-display.md` (metric cards, table)                                                                                                   |
| Sidebar + nav              | `06-navigation.md`                                                                                                                           |
| Every page                 | `08-page-layouts.md` — `PageHeader`, `px-6 py-8`, `space-y-8`                                                                                |

Files already read for this plan: `00-overview.md` (full), `08-page-layouts.md` (full),
`05-data-display.md` and `02-components.md` (partial — tables, empty states, badge
semantics). `03-forms.md`, `04-dialogs.md`, `06-navigation.md` and `07-feedback.md` are
**unread** and must be read at their first use above.

**The automated backstop.** `.claude/hooks/check-design-system.sh` runs on every `.tsx`/`.jsx`
write and blocks on hardcoded Tailwind color scales (Rule 1) and default exports in non-route
files (Rule 3) — both correct, and both enforcing CLAUDE.md. Its Rule 2 currently contradicts
the DS radius scale and is fixed as the first step of Phase 8 (gap **G6**). The hook is a backstop for two
mechanical rules, **not** a substitute for the pre-flight read: it cannot check token
semantics, hierarchy, empty states, or whether a surface has one primary CTA.

### 6.2 Pages

| Page          | Route                     | Contents                                             |
| ------------- | ------------------------- | ---------------------------------------------------- |
| Ticket list   | `/dashboard`              | Tickets with status/priority                         |
| Ticket detail | `/dashboard/tickets/[id]` | Live streaming **Draft-reply** panel (`useAIStream`) |
| Members       | `/admin/members`          | Role management (owner-only)                         |
| Audit         | `/admin/audit`            | Org-scoped `AuditLog` viewer                         |
| Cost          | `/admin/cost`             | `AIUsage` spend view                                 |

### 6.3 Layout and token rules

Binding for every page (from `00-overview.md` and `08-page-layouts.md`):

- `PageHeader` from `@upstart13-com/aiden-ui` on **every** page — renders `border-b border-border px-6 py-5`.
- Content area: `px-6 py-8`, sections `space-y-8`. No global `max-w-*` on data views.
- **No hardcoded colors.** Semantic tokens only — `bg-background`, `text-muted-foreground`,
  `border-border`. No `bg-gray-*` / `text-zinc-*` / `border-slate-*`.
- Radius scale: `rounded-md` inputs, `rounded-lg` buttons/badges, `rounded-xl` cards,
  `rounded-2xl` modals, `rounded-full` only for avatars and status dots.
- **One primary CTA per page section** — everything else `secondary` / `outline` / `ghost`.
- Lucide icons only, `strokeWidth={1.5}`, default `size-4`.
- Empty states are complete: icon + title + description + action.
- Loading is **skeleton-first**, never a full-page spinner.
- Responsive at mobile / tablet / desktop; verify light **and** dark.

### 6.4 Ticket list — `/dashboard`

`PageHeader` ("Tickets" + subtitle + a single primary **New ticket** CTA, hidden for viewers),
then four metric cards (Open / Pending / Resolved / Urgent), then the data table.

Status and priority render as `Badge` variants, per the DS semantics table:

| Value             | Badge                   | Dot                   |
| ----------------- | ----------------------- | --------------------- |
| `open`            | `info`                  | `bg-info`             |
| `pending`         | `warning`               | `bg-warning`          |
| `resolved`        | `success`               | `bg-success`          |
| `closed`          | `secondary`             | `bg-muted-foreground` |
| `urgent` / `high` | `destructive` / `error` | —                     |
| `medium` / `low`  | `secondary` / `outline` | —                     |

Empty state: icon + "No tickets yet" + description + **New ticket** (and, for a viewer, no
action button — a disabled CTA with no explanation is a DS anti-pattern).

### 6.5 Ticket detail — `/dashboard/tickets/[id]`

Breadcrumb above the title (the DS detail-page pattern — `PageHeader` has no breadcrumb slot,
so this one case inlines a wrapper matching `border-b border-border px-6 py-5`), then `Tabs`:
**Conversation** | **AI draft** | **Activity**.

The **Draft reply panel** is the streaming surface:

```tsx
"use client";
import { useAIStream } from "@upstart13-com/aiden-realtime/react";

const { text, isLoading, send, reset, error } = useAIStream(
  `/api/tickets/${id}/draft`,
);
```

- Idle → empty state with a **Draft reply** button.
- Streaming → tokens render as they arrive; the button reads "Drafting…" and is disabled.
- Error → `role="alert"` with a **specific** message. "Something went wrong" is forbidden by
  the DS; a 403 renders "Viewers can't generate AI drafts", a 429 renders "Too many drafts —
  try again in a minute."
- Done → **Copy** and **Regenerate** actions.

The panel is the one `"use client"` island on the page. It imports **no** server module —
`prisma`, `auth`, and anything from `src/lib/*.ts` marked `server-only` stay out of it.

### 6.6 Admin pages

All three are owner-only. `src/app/admin/layout.tsx` already exists and gates the segment —
extend it to check the **membership** role (not the global RBAC role), and render a
403 state rather than redirecting, so an owner-less member learns why.

- **Members** — table of org members (name, email, role, joined). Role changes via a `Select`
  (needs `npx shadcn@latest add select` — not re-exported by `aiden-ui`). Confirmation dialog
  on demotion. The last-owner guard from [§3.9](#39-additional-hardening) surfaces as an
  inline error, not a toast that vanishes.
- **Audit** — reverse-chronological table (timestamp, event, actor, resource, IP). Filter by
  event. Denial events (`security.ownership_failed`, `security.ability_denied`) rendered with
  a `destructive` badge so the security signal is visible at a glance.
- **Cost** — metric cards (total spend, total tokens, calls, 30-day spend), spend-by-feature
  and spend-by-model breakdowns, then the recent-calls table. Money formatted via
  `Intl.NumberFormat` with 4 decimal places — per-call costs are fractions of a cent.

### 6.7 Navigation

Extend `src/config/nav.ts` (the single source of truth):

```ts
export const primaryNavItems: DashboardNavItem[] = [
  {
    href: "/dashboard",
    label: "Tickets",
    icon: "LayoutDashboard",
    exact: true,
  },
];

export const adminNavItems: DashboardNavItem[] = [
  { href: "/admin/members", label: "Members", icon: "Users", exact: false },
  { href: "/admin/audit", label: "Audit", icon: "ScrollText", exact: false },
  { href: "/admin/cost", label: "Cost", icon: "Receipt", exact: false },
];
```

The layout decides at render time whether to show the admin group, based on the caller's
membership role. Icon names resolve against `defaultNavIconRegistry`; any not in the default
registry are passed through a custom registry rather than imported ad hoc.

### 6.8 Read the API route before writing the fetch

Per `.claude/fixes/ui.md` and CLAUDE.md's "Things to Avoid": every client fetch is written
**after** reading the route that serves it, and the response shape is matched exactly. A
mismatched shape produces a silently empty view, not an error.

Response envelopes are fixed here so both sides agree up front:

| Route                          | Response                                                             |
| ------------------------------ | -------------------------------------------------------------------- |
| `GET /api/tickets`             | `{ tickets: Ticket[], nextCursor: string \| null }`                  |
| `GET /api/tickets/[id]`        | `{ ticket: Ticket }`                                                 |
| `POST /api/tickets`            | `{ ticket: Ticket }` (201)                                           |
| `PATCH /api/tickets/[id]`      | `{ ticket: Ticket }`                                                 |
| `POST /api/tickets/[id]/close` | `{ ticket: Ticket }`                                                 |
| `GET /api/admin/members`       | `{ members: Member[] }`                                              |
| `GET /api/admin/audit`         | `{ entries: AuditLogEntry[], nextCursor: string \| null }`           |
| `GET /api/admin/usage`         | `{ totals: {...}, byFeature: [...], byModel: [...], recent: [...] }` |

---

## 7. Dimension 6 — Bootstrap & ops

### 7.1 Local environment

`docker-compose.yml` already provides Postgres matching `DATABASE_URL` in `.env.local`.

```bash
docker compose up -d                        # Postgres
npm install @anthropic-ai/sdk               # the one provider SDK (optional peer dep)
npm run prisma:merge                        # fragments → schema.prisma
npm run db:migrate                          # migrate dev --name deskline_core
npm run db:seed                             # 2 orgs, 6 users, 8 tickets
npm run dev
```

New env vars for `.env.local` and `.env.example`: `ANTHROPIC_API_KEY`, plus `SEED_PASSWORD`
for the seeded dev accounts. Both are read from the environment — never hardcoded.

### 7.2 `aiden doctor`

Must come back green before the build is considered complete. It validates `aiden.config.ts`,
checks required env vars (derived from the feature flags), warns if `src/app/layout.tsx` lacks
a `ThemeProvider`, and shells out to `osv-scanner` for live CVE scanning.

Two known wrinkles, both already recorded in `.claude/progress.log`:

- `aiden-cli` 2.0.1's config parser strips `//` comments naively and truncates `https://`
  strings, and rejects `as T` annotations (only `as const` is tolerated). Any edit to
  `aiden.config.ts` must avoid both. Adding `defaultProvider` and `models` is safe — they are
  plain string literals inside the existing `as const` object.
- The two CVEs doctor previously reported trace to `aiden-ui` declaring `shadcn` (a bin-only
  CLI) as a **runtime** dependency. The `npm overrides` block in `package.json` clears both.
  Do not remove it. **Upstream fix to raise:** move `shadcn` to `devDependencies` in `aiden-ui`.

### 7.3 `aiden upgrade --dry-run`

Run as a readiness-bar item, with the eight steps it performs explained in the build write-up.
`npx aiden upgrade` is the **only** sanctioned way to bump `@upstart13-com/aiden-*` versions —
never hand-edit `package.json` — because it also runs the codemods and migrations that keep
call sites in step with the SDK, and it opens a dedicated PR to be reviewed and merged
separately from feature work.

### 7.4 Git workflow

Branch `feature/deskline-core`, conventional commits (`feat(tickets):`, `feat(ai):`,
`feat(admin):`). `/ship` to commit, push and open the PR — it gates on `/security-review`.
Never commit `.env*`, `src/generated/`, `.next/`.

---

## 8. Dimension 7 — Verification & grading

### 8.1 Per-change validation

After every implementation step, not just at the end:

```bash
npm run lint          # must be clean
npx tsc --noEmit      # must report EXACTLY the 7 known pre-existing errors — no more
```

Because Phase 0 is out of scope, `tsc` never reaches zero in this build. Compare the **count
and the file list** against [§1.4](#14-pre-existing-breakage--out-of-scope), not against an
empty result: an 8th error, or a different file, is a regression this work introduced. Phase 4
drops the count to 1 when it repairs `src/lib/ai.ts` as its prerequisite.

`npm run build` only before the PR. `/validate` runs the standard loop.

### 8.2 Security smoke suite

`scripts/security-smoke.sh` — curl-based, run against `npm run dev`, exiting non-zero on any
mismatch so it can gate CI.

Gap **G5** rules out `/api/dev/impersonate` (it is a no-op stub). Each persona instead
authenticates for real through the credentials provider, with its own cookie jar:

```bash
# Per persona: fetch CSRF token, sign in, keep the session cookie.
curl -s -c "$JAR" "$BASE/api/auth/csrf" | jq -r .csrfToken > "$TOKEN"
curl -s -b "$JAR" -c "$JAR" -X POST "$BASE/api/auth/callback/credentials" \
  --data-urlencode "csrfToken=$(cat "$TOKEN")" \
  --data-urlencode "email=$EMAIL" --data-urlencode "password=$SEED_PASSWORD"
```

The assertion matrix — **every row asserts an exact status code**:

| #   | Persona          | Action                                                 | Expect                                                                                       |
| --- | ---------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 1   | anonymous        | `GET /api/tickets`                                     | **401**                                                                                      |
| 2   | anonymous        | `GET /api/tickets/{acme-id}`                           | **401**                                                                                      |
| 3   | acme owner       | `GET /api/tickets`                                     | 200, every row `orgId == acme`                                                               |
| 4   | acme owner       | `GET /api/tickets/{acme-agent2-ticket}`                | 200 (owner reads every ticket in org)                                                        |
| 5   | **globex owner** | `GET /api/tickets/{acme-id}`                           | **404** — cross-tenant, never 403                                                            |
| 6   | **globex agent** | `PATCH /api/tickets/{acme-id}`                         | **404**                                                                                      |
| 7   | **globex agent** | `POST /api/tickets/{acme-id}/close`                    | **404**                                                                                      |
| 8   | **acme agent**   | `GET /api/tickets/{acme-agent2-ticket}`                | **404** — same org, another agent's row                                                      |
| 9   | acme agent       | `GET /api/tickets/{own-ticket}`                        | 200                                                                                          |
| 10  | acme agent       | `GET /api/tickets/{assigned-ticket}`                   | 200                                                                                          |
| 11  | **acme viewer**  | `PATCH /api/tickets/{acme-id}`                         | **403** — capability, not visibility                                                         |
| 12  | **acme viewer**  | `POST /api/tickets`                                    | **403**                                                                                      |
| 13  | **acme viewer**  | `POST /api/tickets/{acme-id}/draft`                    | **403** — `assertCan` denies AI                                                              |
| 14  | acme viewer      | `GET /api/tickets/{acme-id}`                           | 200 (read-only is allowed)                                                                   |
| 15  | acme agent       | `GET /api/admin/members`                               | **403**                                                                                      |
| 16  | acme agent       | `GET /api/admin/audit`                                 | **403**                                                                                      |
| 17  | acme agent       | `GET /api/admin/usage`                                 | **403**                                                                                      |
| 18  | **globex owner** | `PATCH /api/admin/members/{acme-member-id}`            | **404**                                                                                      |
| 19  | acme owner       | `POST /api/tickets` with `{}`                          | **400** (Zod)                                                                                |
| 20  | acme agent       | `POST /api/tickets` with `{ orgId: "globex-id", ... }` | 201 **and** the row's `orgId == acme` — the client-supplied `orgId` is ignored, not honoured |
| 21  | acme owner       | `GET /api/admin/audit`                                 | 200, zero entries whose actor is outside acme                                                |
| 22  | acme owner       | `GET /api/admin/usage`                                 | 200, every row `orgId == acme`                                                               |
| 23  | acme owner       | demote the last owner                                  | **400**, org retains an owner                                                                |
| 24  | acme agent       | 11 rapid `POST .../draft`                              | final request **429**                                                                        |
| 25  | acme agent       | `GET /api/tickets/does-not-exist`                      | **404**, body identical to row 8 (missing = not-yours)                                       |
| 26  | acme agent       | `PATCH /api/tickets/{acme-agent2-ticket}`              | **404**                                                                                      |
| 27  | acme agent       | `GET /api/tickets/{globex-id}`                         | **404**                                                                                      |
| 28  | **acme viewer**  | `PATCH /api/tickets/{globex-id}`                       | **404** — not 403: the read runs before `assertCan` (DV8)                                    |
| 29  | **acme viewer**  | `POST /api/tickets/{globex-id}/draft`                  | **404**                                                                                      |
| 30  | acme agent       | `PATCH /api/admin/members/{globex-member-id}`          | **404**                                                                                      |

Rows 5–8 and 18 are the heart of it: **every cross-tenant probe returns 404**, and there is no
input that produces a 403 for a resource in another org — which is exactly the enumeration
leak the design forbids.

Row 20 deserves emphasis: it proves tenancy is enforced _structurally_ (`orgId` is never in a
Zod schema) rather than by a check that could be forgotten.

### 8.3 `/security-review`

Run before the PR — mandatory, and enforced as a gate by `/ship`. Expected focus areas:

- Every route under `src/app/api/**` calls `withAuth` (no public endpoints in this build).
- Every ticket query carries an `orgId` in its `where` — no bare `findUnique({ where: { id } })`.
- No `$executeRawUnsafe`, `eval()`, `dangerouslySetInnerHTML`, `new Function()`.
- No server module (`@/lib/prisma`, `@/lib/auth`, anything `server-only`) imported from a
  `"use client"` file.
- No secret, API key or token hardcoded; no sensitive value passed to `log.*`.
- The AI-provider response is re-validated before it reaches the database ([§4.3](#43-feature-2--triage-classification-structured-output)).

### 8.4 Manual verification

- Both AI features exercised end to end against a live provider: draft streams token-by-token;
  triage writes `priority` / `category` / `sentiment` on create.
- A row lands in `ai_usage` for **both** features, with correct `orgId`, `feature` and non-zero
  `costUSD` — including after a **stream the user aborted mid-draft** (the `finalResponse()`
  path).
- `defaultProvider` flipped to a second provider and both features re-run — the "one config
  line" claim is graded live, so it is verified, not asserted.
- Every page checked in light and dark, at mobile / tablet / desktop widths.

---

## 9. Build sequence

> **Phase 0 is out of scope** (removed 2026-10-30). Its four items are either dropped or
> rehomed to the phase that actually needs them: the `src/lib/ai.ts` repair and the Anthropic
> SDK install become **Phase 4** prerequisites, the `check-design-system.sh` fix becomes a
> **Phase 8** prerequisite, and the `(marketing)/layout.tsx` error is left as found. The build
> therefore starts at **Phase 1**.

Phases 3 and 7 are built **one route at a time**, not as a batch. Each sub-step is a complete
vertical slice — route, guards, audit event — and ends with its own smoke rows green. A route
is not started until the previous one passes, so a perimeter regression is always attributable
to the single route that introduced it.

| Phase               | Work                                                                                                                                                                                                                                                                                                                                                                                       | Done when                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** ✅ Done       | Fragments (`org`, `ticket`, `ai-usage`), `user.prisma` back-refs, merge, migrate, seed                                                                                                                                                                                                                                                                                                     | `db:seed` idempotent; 2 orgs, 6 users, 8 tickets present                                                                                                                            |
| **2** ✅ Done       | `membership.ts`, `tickets.ts` guards, `abilities.ts` rules, `middleware.ts`                                                                                                                                                                                                                                                                                                                | Unit-level: every guard returns the right status                                                                                                                                    |
| **3a** ✅ Done      | `GET /api/tickets` — list. Establishes the perimeter and `ticketVisibilityWhere` against seeded fixtures                                                                                                                                                                                                                                                                                   | Smoke **1, 3**; an agent's query emits an `OR` on `ownerId`/`assigneeId` (verify the SQL, not just the rows)                                                                        |
| **3b** ✅ Done      | `GET /api/tickets/[id]` — get. Carries the whole visibility matrix, so it is built before any write route                                                                                                                                                                                                                                                                                  | Smoke **2, 4, 5, 8, 9, 10, 14** — all three roles, same-org and cross-tenant                                                                                                        |
| **3c** ✅ Done      | `POST /api/tickets` — create (no triage yet; defaults persist)                                                                                                                                                                                                                                                                                                                             | Smoke **12, 19, 20** — including the client-supplied `orgId` being ignored                                                                                                          |
| **3d** ✅ Done      | `PATCH /api/tickets/[id]` — update (no re-classify yet)                                                                                                                                                                                                                                                                                                                                    | Smoke **6, 11** — cross-tenant 404 vs viewer 403, side by side                                                                                                                      |
| **3e** ✅ Done      | `POST /api/tickets/[id]/close` — close + `closedAt`                                                                                                                                                                                                                                                                                                                                        | Smoke **7**; closing an already-closed ticket is idempotent                                                                                                                         |
| **4** ✅ Done       | **Prereq:** `npm install @anthropic-ai/sdk`; repair `src/lib/ai.ts` to read `ai.models` and add `defaultAI()` ([§1.4](#14-pre-existing-breakage--out-of-scope)); API key moved to Phase 10. Then triage (`ai.complete({ responseSchema })`) wired into 3c + 3d.                                                                                                                            | `tsc` error count drops 7 → 1; a provider failure does not fail the write                                                                                                           |
| **5** ✅ Done       | `ai-usage.ts` sink + `withAICall`; register in `instrumentation.ts`                                                                                                                                                                                                                                                                                                                        | Usage sink registered at boot; live rows checked in Phase 10                                                                                                                        |
| **6** ✅ Done       | Draft-reply SSE route                                                                                                                                                                                                                                                                                                                                                                      | Smoke **13, 24**; perimeter runs before the first token; live stream checked in Phase 10                                                                                            |
| **7a** ✅ Done      | `GET /api/admin/members` — the owner-only gate, proven once here                                                                                                                                                                                                                                                                                                                           | Smoke **15**                                                                                                                                                                        |
| **7b** ✅ Done      | `PATCH /api/admin/members/[id]` — role change + last-owner and self-demotion guards                                                                                                                                                                                                                                                                                                        | Smoke **18, 23**                                                                                                                                                                    |
| **7c** ✅ Done      | `GET /api/admin/audit` — org-scoped read ([§5.3](#53-org-scoped-audit-trail))                                                                                                                                                                                                                                                                                                              | Smoke **16, 21**; the denial events logged by 3a–3e are visible                                                                                                                     |
| **7d** ✅ Done      | `GET /api/admin/usage` — spend aggregation. Last, so phases 4–6 have produced real rows to aggregate                                                                                                                                                                                                                                                                                       | Smoke **17, 22**                                                                                                                                                                    |
| **8** ✅ Done       | **Prereq:** narrow the `check-design-system.sh` radius rule (**G6**). Then the **UI pre-flight** ([§6.1](#61-mandatory-pre-flight)), then all five pages + nav                                                                                                                                                                                                                             | Hook passes a DS-correct card; light/dark, three breakpoints, no hardcoded colors                                                                                                   |
| **9** ✅ Done       | Full smoke suite green, `/security-review`, `aiden upgrade --dry-run`, `aiden doctor`                                                                                                                                                                                                                                                                                                      | All green; PR opened via `/ship`                                                                                                                                                    |
| **10** ❌ Cancelled | Set the real `ANTHROPIC_API_KEY` in `.env.local`, then run the live AI checks (triage, draft stream)                                                                                                                                                                                                                                                                                       | Triage fields populate on create/update; draft streams token-by-token; `ai_usage` rows carry `orgId` + `feature` for both triage and draft                                          |
| **11** ✅ Done      | **Ticket editing UI** on the ticket detail page, agents only: an **Edit** dialog for subject and description (react-hook-form + `UpdateTicketBody`; saving re-runs triage), a **Status** picker (Open / Pending / Resolved; closing stays the confirmed button), and an **Assignee** picker (org members or Unassigned), backed by a new read-only `GET /api/members` for the caller's org | An agent can edit, change status and reassign from the UI; viewers and owners see no edit controls; the API keeps returning 403 / 404 as before; tests cover `GET /api/members`     |
| **12** ✅ Done      | **Add members.** Owners add an existing Deskline account to their org by email, with a role: `POST /api/admin/members` (`org.members.manage`, `RoleChangeBody` + email) and an **Add member** dialog on `/admin/members`. No email invites (SendGrid is out of scope); the person registers first. Someone already in an org is refused (one org per user, D4)                             | An owner can add a registered user as agent or viewer; unknown email and already-a-member are clear 400s; non-owners 403; another org's owner can't touch it; tests cover each case |
| **12a** ✅ Done     | **Profile shows the org role.** The starter's "Your roles" card on `/dashboard/settings/profile` listed the unused app-wide `Role` records (always "No roles assigned"). It becomes "Your organization": org name, membership role and what that role allows. `GET /api/me` adds `orgName` to `membership`                                                                                 | The card shows e.g. "Acme Support · Owner" with the role's description, or a clear message when the user has no org; `/api/me` tests cover `orgName`                                |
| **13** ❌ Cancelled | **Reopen closed tickets.** `POST /api/tickets/[id]/reopen` for agents; `PATCH` stops changing closed tickets                                                                                                                                                                                                                                                                               | Cancelled 2026-10-30 before any code landed; closed tickets stay closed                                                                                                             |
| **14** ❌ Cancelled | **Create and rename orgs.** `POST /api/orgs`, `PATCH /api/org` and a new `org.update` action                                                                                                                                                                                                                                                                                               | Cancelled 2026-10-30; orgs are still created only by the seed                                                                                                                       |
| **15** ✅ Done      | **Ticket list filters and paging.** `/dashboard` gets Status and Priority filters and cursor paging (**Next page** / **First page**), all in the URL (`?status=&priority=&cursor=`) and passed straight to the existing `GET /api/tickets`                                                                                                                                                 | Filters combine; paging walks every visible ticket without repeats; an agent still sees only own or assigned tickets; empty filter results show a clear empty state with a reset    |
| **16** ✅ Done      | **Assignee on the ticket list.** `/dashboard` shows an **Assignee** column (name, or "Unassigned") and an **Assignee** filter (Unassigned or any org member) next to Status and Priority, kept in the URL (`?assignee=`). `GET /api/tickets` returns `assignee { name, email }` and accepts `assignee=<userId>                                                                             | unassigned`; `GET /api/members` opens to every role (`ticket.read`) so owners and viewers get the filter options                                                                    | The filter combines with status, priority and paging; an agent still sees only own or assigned tickets; an unknown assignee in the URL is ignored; tests cover the new query and the members gate |

Every sub-step from **3a** through **7d** ends with `npm run lint && npx tsc --noEmit`, and
re-runs **every** smoke row passed so far — not just its own. The suite is cumulative, so a
later route that weakens an earlier guard fails the build at the step that caused it.

Phase 8 opens by fixing the **G6** hook rule, then the §6.1 pre-flight read — the
binding gate, since the `frontend-design` skill CLAUDE.md names does not exist (**G4**).
Without the hook fix first, every DS-correct card and button is blocked on write.

Natural commit boundaries: one commit per sub-step (`feat(tickets): add org-scoped list route`),
which keeps each perimeter change reviewable on its own in the PR.

---

## 10. Explicitly out of scope

Building any of the following is scope creep:

- **Helpdesk breadth** — SLAs, attachments, email ingestion, webhooks, notifications, billing,
  multi-channel.
- **A third AI feature.** "Summarize thread" is a named stretch goal, not core. The AI surface
  is exactly one SSE feature plus one structured-output use.
- **Tool-using / agentic AI loop** — a Professional-tier addition. `aiden-ai` supports tool use;
  this build does not use it.
- **External paid infrastructure** — Snowflake, Okta, Stripe, SendGrid, hosted vector DB.
- **Hand-editing the composed schema or the generated client** (`prisma/schema.prisma`, `src/generated/prisma/`). The schema comes from
  fragments; the client is generated and gitignored.
- **A second `createAuth` call**, a custom SSE encoder, or WebSockets. SSE only in v1.
- **Subjective grading of AI prose.** Only the perimeter, safety, streaming, telemetry and
  structure are graded.
- **A fourth RBAC role, or CASL conditions** unless a predicate genuinely needs them. The
  `MembershipRole` Postgres enum makes a fourth role a migration, not an accident.
- **Live AI evidence** (added 2026-10-30): `AIUsage` rows in Prisma Studio, a captured SSE
  draft and the injection probe against a real provider. SDK limitations block it, as agreed
  with the tester; AI is verified only against the fake client in `tests/`.
- **CI run with `aiden migrate`** (Professional tier), skipped 2026-10-30.
- **Replacing an `@upstart13-com/aiden-*` primitive** with a local or third-party equivalent.
  Where a primitive falls short ([§1.3](#13-known-gaps-in-the-aiden-sdk-to-raise-upstream-per-claudemd)),
  the SDK is extended and the gap raised upstream.

---

## 11. Approval checklist

**All items approved 2026-10-29.** The plan is approved; **the build has not started** —
**Phase 0 was subsequently removed from scope (2026-10-30);** the build starts at Phase 1.

- [x] **D4** confirmed — one active org per user in v1 ([§1.2](#12-scope-boundary--one-active-org-per-user-d4))
- [x] **G4** resolved — no skill authored; `docs/design-system/*` + CLAUDE.md's Pre-Flight table are the authority, formalised in [§6.1](#61-mandatory-pre-flight)
- [x] **G6** accepted — narrow the `check-design-system.sh` radius rule as the first step of **Phase 8**
- [x] **G1 / G2 / G3** accepted as interim approaches, and to be filed upstream
- [x] **Phase 0 dropped (2026-10-30)** — pre-existing breakage is no longer in scope; `tsc` stays at its 7-error baseline and the gate becomes _no new errors_ ([§8.1](#81-per-change-validation))
- [x] **`ANTHROPIC_API_KEY`** accepted as a prerequisite — **not yet supplied**: the variable exists in `.env.local` but is commented out and empty. Now a **Phase 4** prerequisite; Phases 1–3e do not require it.

### 11.1 What approval covers

Approved: the resource family ([§2.1](#21-frozen-resource-family)), the two-axis
403/404 perimeter ([§3.1](#31-the-two-axis-model)), the eight ability actions
([§3.4](#34-abilities-srclibabilitiests)), the ten routes
([§3.7](#37-routes)), the two AI surfaces ([§4](#4-dimension-3--ai-surface)), the
24-row smoke matrix ([§8.2](#82-security-smoke-suite)), the build sequence
([§9](#9-build-sequence)), and the out-of-scope list ([§10](#10-explicitly-out-of-scope)).

Re-approval is needed only if a change would widen scope beyond
[§10](#10-explicitly-out-of-scope), add a role or resource, alter the 403/404 contract, or
add a third AI surface. Everything else — naming, file layout, the shape of a Zod schema — is
a build-time detail.

### 11.2 Not approved by this checklist

- **The four unread DS files** (`03-forms.md`, `04-dialogs.md`, `06-navigation.md`,
  `07-feedback.md`). They are read at first use per [§6.1](#61-mandatory-pre-flight); if one
  contradicts a UI choice sketched in [§6](#6-dimension-5--ui--ux), the DS file wins and §6 is
  corrected.
- **The upstream SDK fixes** for G1–G3 and G6. Approval here accepts the _interim_ approaches
  only; filing them is tracked separately and does not gate the build.

---

## 12. Brief dimensions: outcome, audit, files touched, rollback

Added 2026-10-30, after checking the build against the capstone brief. The approved plan
covered these inside other sections, or not at all; they are written out here so each of the
brief's seven dimensions has its own section.

### 12.1 Outcome

What each persona sees, not how it is built.

| Flow                       | Agent                                                                                                                  | Viewer                         | Owner                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Ticket list (`/dashboard`) | Own and assigned tickets, filtered by status/priority, 25 per page                                                     | Every ticket in the org        | Every ticket in the org                                                                                             |
| Create a ticket            | **New ticket** dialog; the ticket opens with priority, category and sentiment filled in by triage                      | No button; the API answers 403 | No button; the API answers 403                                                                                      |
| Ticket detail              | Edit subject/description (re-runs triage), change status, reassign, close with confirmation                            | Read only                      | Read only                                                                                                           |
| AI draft reply             | **AI draft** tab: pick a tone, the reply streams in, then Copy / Regenerate / Discard. Nothing is sent to the customer | No tab; the API answers 403    | No tab; the API answers 403                                                                                         |
| Triage                     | Runs on create, and on edit when subject or description changes. A provider failure never blocks saving the ticket     | —                              | —                                                                                                                   |
| Another org's ticket       | 404 page, the same as a ticket that doesn't exist                                                                      | 404                            | 404                                                                                                                 |
| Admin                      | —                                                                                                                      | —                              | Members (add by email, change role), Audit (org-scoped, filter by event), Cost (spend by member, feature and model) |

### 12.2 Audit events

Every app event carries `resourceId` and `metadata.orgId`; `requestId` and the actor come from
the request context. No ticket subject, body, prompt or draft text is ever in metadata.

| Event                                                  | Emitted by                                          | `resourceId`  | `metadata`                                   |
| ------------------------------------------------------ | --------------------------------------------------- | ------------- | -------------------------------------------- |
| `ticket.create`                                        | `POST /api/tickets`                                 | ticket id     | `orgId`                                      |
| `ticket.update`                                        | `PATCH /api/tickets/[id]`                           | ticket id     | `orgId`, `fields` (names only)               |
| `ticket.close`                                         | `POST /api/tickets/[id]/close`                      | ticket id     | `orgId`                                      |
| `ai.classify`                                          | `triageTicket` after a successful, validated triage | ticket id     | `orgId`, `priority`, `category`, `sentiment` |
| `ai.draft`                                             | `POST /api/tickets/[id]/draft`                      | ticket id     | `orgId`, `tone`                              |
| `member.add`                                           | `POST /api/admin/members`                           | membership id | `orgId`, `role`                              |
| `member.role_change`                                   | `PATCH /api/admin/members/[id]`                     | membership id | `orgId`, `from`, `to`                        |
| `security.ownership_failed`, `security.ability_denied` | `aiden-security`, automatically                     | —             | reason                                       |
| `auth.signin`, `auth.signout`, `auth.register`         | `aiden-auth`, automatically                         | user id       | —                                            |

**Swappable sink.** `audit.sink` in `aiden.config.ts` picks the sink registered in
`src/lib/audit.ts`:

- `"prisma"` (default): the `audit_logs` table, read by `/admin/audit`.
- `"file"`: one JSON object per line in `AUDIT_LOG_FILE` (default `logs/audit.jsonl`).

**Retention (D7):** with the file sink, the customer owns the audit store. They decide where
it is shipped and how long it is kept; Deskline neither rotates nor deletes it. The in-app
viewer shows nothing while the file sink is selected, because it reads `audit_logs`.

### 12.3 Files touched

Relative to the starter commit (`b1e73c1`).

**Schema and data**

| File                                                      | Note                                                                                        |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `prisma/fragments/org.prisma`                             | New: `Org`, `Membership`, `MembershipRole` enum                                             |
| `prisma/fragments/ticket.prisma`                          | New: `Ticket` and its status/priority/sentiment enums, org-scoped indexes                   |
| `prisma/fragments/ai-usage.prisma`                        | New: `AIUsage`, cascades from `Org`                                                         |
| `prisma/fragments/user.prisma`                            | Back-relations to memberships and owned/assigned tickets                                    |
| `prisma/migrations/*_deskline_core`, `*_relation_hygiene` | Generated by `npm run db:migrate`                                                           |
| `prisma/schema.prisma`                                    | Regenerated by `aiden-db-merge-schema`, never edited by hand                                |
| `prisma/seed.ts`                                          | Two orgs, six users across the three roles, eight fixture tickets; `SEED_PASSWORD` required |
| `prisma.config.ts`                                        | Seed command for Prisma 7                                                                   |

**Server**

| File                                                                    | Note                                                                                        |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/lib/abilities.ts`                                                  | Role → action matrix through `defineAbilities`                                              |
| `src/lib/membership.ts`                                                 | `requireMembership` (no org → 404), member list for assignment                              |
| `src/lib/tickets.ts`                                                    | `ticketSelect`, `ticketVisibilityWhere`, `findVisibleTicket` (the two-step), summary counts |
| `src/lib/validation/ticket.ts`, `admin.ts`                              | Zod schemas for every body and query                                                        |
| `src/lib/ai.ts`                                                         | Provider-agnostic `createAIClient`, memoised `defaultAI()`                                  |
| `src/lib/prompts.ts`                                                    | System prompts, ticket fencing, per-route `maxTokens`                                       |
| `src/lib/triage.ts`                                                     | Structured-output triage, re-validated, audited as `ai.classify`                            |
| `src/lib/ai-usage.ts`                                                   | `setAIUsageSink` → `ai_usage`, tagged with org and feature                                  |
| `src/lib/audit.ts`                                                      | Prisma and file audit sinks behind `audit.sink`                                             |
| `src/lib/security.ts`                                                   | Imports `@/lib/audit` so routes always have the sink                                        |
| `src/lib/admin.ts`                                                      | Members, org-scoped audit entries, usage summary                                            |
| `src/lib/api-client.ts`, `api-types.ts`, `page-context.ts`, `format.ts` | Pages read through the API with the session cookie                                          |
| `src/middleware.ts`                                                     | `securityHeaders`                                                                           |
| `src/instrumentation.ts`                                                | Registers the usage sink at boot                                                            |
| `src/app/api/tickets/**`                                                | List, create, get, update, close, draft (SSE), summary                                      |
| `src/app/api/members/route.ts`                                          | Org members for the assignee picker                                                         |
| `src/app/api/admin/{members,audit,usage}/**`                            | Owner-only admin routes                                                                     |
| `src/app/api/me/route.ts`, `me/signins/route.ts`                        | Adds `orgName` to the profile; sign-in history                                              |
| `aiden.config.ts`                                                       | AI providers/models, `audit.sink`                                                           |

**UI**

| File                                                                    | Note                                                               |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/app/layout.tsx`                                                    | `ThemeProvider` and the single `Toaster`                           |
| `src/components/app-shell.tsx`                                          | Sidebar and header for `/dashboard` and `/admin`                   |
| `src/app/dashboard/page.tsx`                                            | Ticket list, summary, filters, paging                              |
| `src/app/dashboard/tickets/[id]/page.tsx`                               | Ticket detail with edit, status, assignee, close and the draft tab |
| `src/components/tickets/*`                                              | Dialogs, menus, badges, filters, the `useAIStream` draft panel     |
| `src/app/admin/{members,audit,cost}/page.tsx`, `src/components/admin/*` | Owner pages                                                        |
| `src/components/settings/profile-section.tsx`                           | "Your organization" card                                           |
| `src/config/nav.ts`, `src/app/{admin,dashboard}/layout.tsx`             | Navigation and route gating                                        |

**Tests, scripts and docs**

| File                                        | Note                                                      |
| ------------------------------------------- | --------------------------------------------------------- |
| `tests/**`, `vitest.config.mts`             | Unit and route tests with a fake AI client                |
| `scripts/security-smoke.sh`                 | Graded curl suite (§8.2)                                  |
| `postman/deskline.postman_collection.json`  | Manual API collection                                     |
| `README.md`, `docs/*.md`, `docs/evidence/*` | Run steps, demo, ops diagnosis, self-assessment, evidence |

### 12.4 Rollback

| What              | How                                                                                                                                                                                                                                                                                                                     | Reversible?                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| AI features       | Set every `ai.providers.*` to `false` in `aiden.config.ts` and restart. Triage is skipped (tickets save untriaged) and the draft route returns an error; no route changes                                                                                                                                               | Yes                                                    |
| Audit destination | Switch `audit.sink` between `"prisma"` and `"file"`                                                                                                                                                                                                                                                                     | Yes                                                    |
| Application code  | `git revert` the feature commits (or redeploy the previous build)                                                                                                                                                                                                                                                       | Yes                                                    |
| Schema            | Prisma has no down migrations. Generate the down step with `npx prisma migrate diff --from-config-datasource --to-schema <previous schema.prisma> --script` (the previous schema from `git show <commit>:prisma/schema.prisma`), review it, and ship it as a new migration. Locally, `npx prisma migrate reset` instead | With a new migration; dropping tables loses their data |
| Seed data         | `npm run db:seed` restores the fixtures                                                                                                                                                                                                                                                                                 | Yes                                                    |
| Audit rows        | **Not reversed.** Rows written to `audit_logs` (or the file sink) stay, by design: an audit trail that a rollback could erase would not be an audit trail                                                                                                                                                               | Accepted as non-reversible                             |
