# Deskline

A multi-tenant support desk. Inside each organization, agents triage and resolve customer
tickets with help from AI that classifies new tickets and drafts replies. Built on the AIDEN
starter (`@upstart13-com/aiden-*` packages) with Next.js 16, Prisma 7 and PostgreSQL.

- **Plan:** [docs/plans/deskline.md](docs/plans/deskline.md) (approved, with deviation notes in §1.5)
- **Ops runbook:** [docs/ops-diagnosis.md](docs/ops-diagnosis.md)
- **Demo script:** [docs/demo-walkthrough.md](docs/demo-walkthrough.md)
- **Evidence:** [`aiden doctor`](docs/evidence/aiden-doctor.md), [`aiden upgrade --dry-run`](docs/evidence/aiden-upgrade-dry-run.md), [`/security-review`](docs/evidence/security-review.md), [security smoke suite](docs/evidence/security-smoke.md)
- **Self-assessment:** [docs/self-assessment.md](docs/self-assessment.md)

## Roles

| Role   | Can                                                                                                            | Cannot                                |
| ------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Owner  | Read every ticket in the org; add members by email and change their roles; read the audit trail and AI cost    | Create, edit or close tickets; use AI |
| Agent  | Create, edit, reassign, change the status of and close tickets they own or are assigned; draft replies with AI | See other agents' tickets             |
| Viewer | Read every ticket in the org                                                                                   | Change tickets or use AI (403)        |

Another organization's data is always a **404**, never a 403.

---

## Run it locally

### 1. Prerequisites

- Node.js 22 and npm
- Docker (for the local Postgres)
- [`osv-scanner`](https://google.github.io/osv-scanner/) (`brew install osv-scanner`), used by `aiden doctor`
- The `aiden` CLI (`@upstart13-com/aiden-cli`)
- A GitHub classic token with `read:packages`, SSO-authorized for the Upstart13-com org.
  The `@upstart13-com/*` packages install from GitHub Packages.

### 2. Package registry access

```bash
cp .npmrc.example .npmrc          # points @upstart13-com at npm.pkg.github.com
export GITHUB_PAT=ghp_your_token  # put this in ~/.zshrc so every shell has it
npm install
```

If `npm install` crashes with `Cannot read properties of null (reading 'edgesOut')`, use
`npm install --legacy-peer-deps` (a peer-resolution bug in npm 10.9.8).

### 3. Environment

```bash
cp .env.example .env.local
openssl rand -base64 32           # paste the output as AUTH_SECRET
```

| Variable            | Required             | Notes                                                                                               |
| ------------------- | -------------------- | --------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`      | yes                  | `postgresql://postgres:postgres@localhost:5432/deskline` for the Docker database below              |
| `AUTH_SECRET`       | yes                  | NextAuth signing secret                                                                             |
| `ANTHROPIC_API_KEY` | when Anthropic is on | Needed once `providers.anthropic` is `true` (see [Switch the AI provider](#switch-the-ai-provider)) |
| `SEED_PASSWORD`     | for seeding          | Password for every seeded account. There is no default; choose your own.                            |
| `INTERNAL_API_URL`  | no                   | Origin pages use to call the app's own API. Defaults to `http://localhost:$PORT`.                   |
| `LOG_LEVEL`         | no                   | `info` by default                                                                                   |

### 4. Local Postgres

```bash
docker compose up -d
```

### 5. About `aiden init`

This repo was created from the AIDEN starter (`aiden init`), so **don't run it again here**.
For a brand-new app, `aiden init <name>` scaffolds the starter, installs dependencies, stamps
the current version into `aiden.config.ts` and runs the first migration.

### 6. Schema, migrations and seed

The Prisma schema is composed from fragments, never edited directly:
`prisma/fragments/*.prisma` plus the AIDEN-shipped auth, RBAC and audit fragments, merged by
`aiden-db-merge-schema` into `prisma/schema.prisma`.

```bash
npm run prisma:merge        # aiden-db-merge-schema: fragments → prisma/schema.prisma
npm run prisma:generate     # merge + generate the Prisma client into src/generated/prisma
```

Apply migrations:

| Where             | Command              | What it runs                                                                        |
| ----------------- | -------------------- | ----------------------------------------------------------------------------------- |
| Local development | `npm run db:migrate` | merge + `prisma migrate dev` (creates new migrations as you change fragments)       |
| CI / production   | `aiden migrate`      | `prisma migrate deploy` (applies committed migrations only, never creates new ones) |

Seed the two demo organizations:

```bash
npm run db:seed
```

| Org                       | Accounts                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Acme Support (`acme`)     | `owner@acme.test` (owner), `agent@acme.test` (agent), `agent2@acme.test` (agent), `viewer@acme.test` (viewer) |
| Globex Support (`globex`) | `owner@globex.test` (owner), `agent@globex.test` (agent)                                                      |

All of them use your `SEED_PASSWORD`. The seed is idempotent; re-running it restores the
fixture tickets and roles.

### 7. Check and start

```bash
aiden doctor     # config, required env vars, CVE scan, npm audit, ThemeProvider wiring
npm run dev      # http://localhost:3000
```

### 8. Tests

```bash
npm test         # Vitest: unit tests + route tests against the local database
```

Route tests run against your local database (reseeded first, cleaned up after). Sign-in and
the AI provider are mocked, so tests never call a real model.

---

## Switch the AI provider

Everything AI goes through one client built from `aiden.config.ts`. Routes never name a
provider, so switching is a config change.

> **AI is off in the committed config** (every `providers.*` is `false`). Tickets are still
> created without triage, and **Draft reply** returns an error. To turn AI on, set
> `providers.anthropic: true`, put `ANTHROPIC_API_KEY` in `.env.local` and restart.

```ts
// aiden.config.ts
ai: {
  defaultProvider: "anthropic",          // ← the one line to change, e.g. "openai"
  providers: {
    openai: false,                       // ← enable the provider you switch to
    anthropic: true,
    // …
  },
  models: {
    openai: "gpt-4o-mini",               // model used for each provider
    anthropic: "claude-haiku-4-5",
    // …
  },
},
```

To switch to OpenAI, for example:

1. Set `defaultProvider: "openai"` and `providers.openai: true`.
2. Install its SDK: `npm install openai` (provider SDKs are optional peer dependencies).
3. Add `OPENAI_API_KEY` to `.env.local`.
4. Restart `npm run dev`.

If `defaultProvider` names a provider that isn't enabled, the app refuses to start AI calls
with a clear error rather than silently using another one.

---

## Project layout

| Path                                      | What's there                                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------- |
| `prisma/fragments/`                       | `org.prisma` (Org, Membership), `ticket.prisma`, `ai-usage.prisma`, `user.prisma` |
| `src/app/api/`                            | Route handlers: tickets, draft (SSE), members, admin members/audit/usage, me      |
| `src/app/dashboard`, `src/app/admin`      | Pages. They read data only through the API routes (`src/lib/api-client.ts`).      |
| `src/lib/abilities.ts`                    | Role → action matrix                                                              |
| `src/lib/tickets.ts`                      | Ticket visibility: org-scoped queries confirmed by `assertOwnership`              |
| `src/lib/triage.ts`, `src/lib/prompts.ts` | Structured-output triage and the fenced prompts                                   |
| `src/lib/ai-usage.ts`                     | AI cost telemetry sink → `ai_usage`                                               |
| `tests/`                                  | Vitest unit and route tests                                                       |

## Security checks

- `aiden doctor`: config, env, `osv-scanner` and `npm audit`
- `/security-review` in Claude Code before every PR (run automatically by `/ship`)
- `npm test`: perimeter tests for every route (401, 400, 403, cross-tenant 404)
- `scripts/security-smoke.sh`: the same perimeter over curl against `npm run dev`, 24 graded rows

## Upgrading AIDEN

Never hand-edit `@upstart13-com/aiden-*` versions. Use:

```bash
aiden upgrade --dry-run   # preview
aiden upgrade             # needs a clean working tree; commits the result
```

See [docs/ops-diagnosis.md](docs/ops-diagnosis.md) for why an upgrade can do nothing and how
to recover from a bad one.
