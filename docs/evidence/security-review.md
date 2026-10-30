# Evidence: `/security-review`

Claude Code's `/security-review` command (`.claude/commands/security-review.md`), run on
branch `docs/deskline-plan` against `main` (the repo has no `develop` branch).

## First run: FAIL (2026-10-30 14:26)

93 changed files across 12 commits. Dependencies were clean; the code analysis found five HIGH
issues in two categories.

| Category               | Status   | Findings                                                                                                                                                        |
| ---------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth & Access Control  | PASS     | Every data route uses `withAuth`; queries are scoped to the caller's org or user. Only the NextAuth handlers and `register` are public, by design. No webhooks. |
| Injection Prevention   | PASS     | No unsafe raw SQL, `eval`, `new Function` or `dangerouslySetInnerHTML`. Bodies go through `parseRequest`; query strings through Zod.                            |
| Data Exposure          | **FAIL** | Whole database rows returned without an explicit `select` (4 findings).                                                                                         |
| Stripe Security        | N/A      | No Stripe code.                                                                                                                                                 |
| Server/Client Boundary | PASS     | `"use client"` files import only Zod schemas, `aiden-ui` and `aiden-realtime/react`. No server actions.                                                         |
| Sensitive Data         | **FAIL** | A hardcoded default password for the seeded accounts.                                                                                                           |

| Source      | Critical | High | Medium | Low |
| ----------- | -------- | ---- | ------ | --- |
| npm audit   | 0        | 0    | 0      | 0   |
| osv-scanner | 0        | 0    | 0      | 0   |

New packages checked for CVEs: `@anthropic-ai/sdk@1.3.0`, `pino-pretty@13.2.0` and
`vitest@4.1.12`, all clear. Known advisories for the SDK were fixed before 1.3.0, the
`pino-pretty` hits were look-alike packages, and 4.1.12 is the Vitest release that fixes
CVE-2026-112950.

## Findings and how they were resolved

| #   | Severity | Finding                                                                                            | Resolution                                                                                                                                                                                                          |
| --- | -------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | HIGH     | Ticket routes (list, get, create, update, close) returned full `Ticket` rows.                      | One shared `ticketSelect` in `src/lib/tickets.ts`; every ticket query and the triage update use it.                                                                                                                 |
| 2   | HIGH     | `/api/admin/audit` returned full `AuditLog` rows, including IP address, user agent and request id. | Selects only id, event, actor, resource, metadata and timestamp. The rest stays server-side; the audit page never showed it.                                                                                        |
| 3   | HIGH     | `/api/admin/usage` returned full `AIUsage` rows in `recent`.                                       | Selects only id, feature, model, tokens, cost and time.                                                                                                                                                             |
| 4   | HIGH     | The member role change returned the full `Membership` row.                                         | Returns `{ id, role }`; its internal lookup selects only what the role checks need.                                                                                                                                 |
| 5   | HIGH     | `prisma/seed.ts` fell back to a hardcoded password, also committed in `.env.example`.              | The seed has no default and stops with "SEED_PASSWORD is not set"; `.env.example` leaves it blank. The old value is still in git history, so local `.env.local` values should be changed and the database reseeded. |

Not findings: the seed's `console.log` prints only row counts, and `log.error` calls log ids
and provider errors, never prompts, ticket bodies or secrets.

## Re-check after the fixes: PASS (2026-10-30)

- A scan for ticket, audit, usage and membership queries without `select` finds none whose
  result reaches a response. The only remaining one is the usage write inside the telemetry
  sink, which never leaves the server.
- Routes without `withAuth`: only `api/auth/[...nextauth]` and `api/auth/register` (public by design).
- `req.json()` in routes: 0. Unsafe sinks: 0. Client files importing server modules: 0.
- Secret patterns in tracked files: only the review's own search patterns, in
  `.claude/commands/security-review.md` and `.claude/hooks/security-check.sh`.
- `NEXT_PUBLIC_*` variables: only app name, tagline, description and copyright.
- `npm audit`: 0 vulnerabilities. `osv-scanner`: no issues found.
- `npm test`: 121 tests pass, including the perimeter tests for every route (count at the time of this re-check).

**Verdict after fixes: PASS.** No CRITICAL or HIGH findings remain. `/ship` runs the review
again before it opens the PR.

## Re-check of Phases 11–15: PASS (2026-10-30)

Code added after the review above: `GET /api/members` (Phase 11), `POST /api/admin/members`
(Phase 12), `orgName` on `GET /api/me` (Phase 12a), and the `/dashboard` filters and paging
(Phase 15). Same checks, limited to the new code.

| Category               | Status | Notes                                                                                                                                                                                               |
| ---------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth & Access Control  | PASS   | Both new routes use `withAuth`, then `requireMembership` (no org → 404) and `assertCan` (`ticket.update` / `org.members.manage` → 403). Every query is scoped to the caller's `orgId`.              |
| Injection Prevention   | PASS   | The add-member body goes through `parseRequest(AddMemberBody)`. The list page sends only allow-listed `status` / `priority` values; the API re-validates them and `cursor` with `ListTicketsQuery`. |
| Data Exposure          | PASS   | Every new query has an explicit `select`. Member lists return id, name, email and role only.                                                                                                        |
| Server/Client Boundary | PASS   | `add-member-dialog.tsx` and `ticket-filters.tsx` import no server modules.                                                                                                                          |
| Sensitive Data         | PASS   | No secrets or tokens in the new code.                                                                                                                                                               |

Justified, not fixed:

- **Add member tells an owner whether an email has an account**, and whether it already
  belongs to some other org. Owners need that to know why an add failed. The other org is
  never named, the route is owner-only, and each attempt is authenticated and audited.

Dependencies after these phases: `npm audit` 0 vulnerabilities, `osv-scanner` no issues. The
full test suite was not re-run for this addendum; `tests/api/members.test.ts`,
`tests/api/add-member.test.ts` and `tests/api/me.test.ts` cover the new routes.

**Verdict: PASS.**

## Fix found by the capstone-brief check (2026-10-30)

**[HIGH] Auth & Access Control — perimeter order.** `PATCH /api/tickets/[id]`, `POST .../close`,
`POST .../draft` and `PATCH /api/admin/members/[id]` ran `assertCan` before the org-scoped
read. A viewer therefore got **403** for another org's ticket (and for a missing id), where the
contract is 404 for every cross-tenant id. The read and `assertOwnership` now run first, then
`assertCan` (plan DV8). Smoke rows 28–30 cover it: before the fix rows 28 and 29 returned 403,
now all three return 404. Route and unit tests: 135 pass.
