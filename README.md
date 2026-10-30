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

**Quick start** for a fresh clone, once the prerequisites below are in place:

```bash
cp .npmrc.example .npmrc && export GITHUB_PAT=ghp_your_token
npm install                         # also generates the Prisma client (postinstall)
cp .env.example .env.local          # then fill in DATABASE_URL, AUTH_SECRET, SEED_PASSWORD
docker compose up -d                # local Postgres on :5432
npm run prisma:merge                # aiden-db-merge-schema: fragments → prisma/schema.prisma
npx aiden migrate                   # apply the committed migrations
npm run db:seed                     # two demo orgs, six accounts, sample tickets
npx aiden doctor                    # must end with "All checks passed."
npm run dev                         # http://localhost:3000
```

Each step is explained below.

### 1. Prerequisites

- Node.js 22 and npm
- Docker, for the local Postgres
- [`osv-scanner`](https://google.github.io/osv-scanner/) (`brew install osv-scanner`). `aiden doctor` runs it.
- The AIDEN CLI. It isn't a project dependency, so install it globally (or prefix every
  command with `npx @upstart13-com/aiden-cli` instead of `npx aiden`):

  ```bash
  npm install -g @upstart13-com/aiden-cli
  ```

- A GitHub classic token with `read:packages`, SSO-authorized for the Upstart13-com org. The
  `@upstart13-com/*` packages install from GitHub Packages.

### 2. Install

```bash
cp .npmrc.example .npmrc          # points @upstart13-com at npm.pkg.github.com
export GITHUB_PAT=ghp_your_token  # put this in ~/.zshrc so every shell has it
npm install
```

`npm install` runs `prisma:generate` afterwards, so the Prisma client in
`src/generated/prisma` is ready without another command.

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
| `SEED_PASSWORD`     | for seeding          | Password for every seeded account. There is no default; choose your own.                            |
| `ANTHROPIC_API_KEY` | when Anthropic is on | Needed once `providers.anthropic` is `true` (see [Switch the AI provider](#switch-the-ai-provider)) |
| `INTERNAL_API_URL`  | no                   | Origin pages use to call the app's own API. Defaults to `http://localhost:$PORT`.                   |
| `LOG_LEVEL`         | no                   | `info` by default                                                                                   |
| `AUDIT_LOG_FILE`    | no                   | Where the file audit sink writes, when `audit.sink` is `"file"`. Defaults to `logs/audit.jsonl`.    |

`aiden doctor` checks that every variable the enabled features need is set.

### 4. Local Postgres

```bash
docker compose up -d
```

`docker-compose.yml` starts Postgres 17 as `deskline-db` on port 5432, with user and password
`postgres` and database `deskline`, matching the `DATABASE_URL` above. Data lives in the
`postgres-data` volume; `docker compose down -v` deletes it.

### 5. About `aiden init`

This repo was created from the AIDEN starter, so **don't run `init` here**. For a brand-new app:

```bash
npx @upstart13-com/aiden-cli init my-app
```

It asks which AI and OAuth providers the app uses and its display name, copies the starter
into `my-app/`, installs dependencies, and, if `DATABASE_URL` is set, runs
`prisma migrate dev --name init`. Flags: `--yes` (no prompts), `--skip-install`,
`--skip-migrate`.

### 6. Schema: `aiden-db-merge-schema`

The Prisma schema is composed from fragments and never edited by hand. `aiden-db.config.json`
lists the inputs: this app's `prisma/fragments/*.prisma` (`org`, `ticket`, `ai-usage`, `user`)
plus the auth, audit and RBAC fragments shipped in `@upstart13-com/aiden-db`.
`aiden-db-merge-schema` combines them into `prisma/schema.prisma`.

```bash
npm run prisma:merge        # runs aiden-db-merge-schema
npm run prisma:generate     # merge + regenerate the Prisma client
```

`npm run dev`, `npm run build`, `db:migrate` and `db:push` all run the merge first. To change
the schema, edit a fragment, never `schema.prisma`.

### 7. Migrations: `npm run db:migrate` vs `aiden migrate`

| Where                       | Command              | What it runs                                                                                      |
| --------------------------- | -------------------- | ------------------------------------------------------------------------------------------------- |
| Local development           | `npm run db:migrate` | merge + `prisma migrate dev`: creates a new migration when you change a fragment, then applies it |
| Fresh clone, CI, production | `npx aiden migrate`  | `prisma migrate deploy`: applies the committed migrations only, never creates new ones            |

The committed migrations are `prisma/migrations/*_deskline_core` and `*_relation_hygiene`.

### 8. Seed

```bash
npm run db:seed             # runs prisma/seed.ts (configured in prisma.config.ts)
```

| Org                       | Accounts                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Acme Support (`acme`)     | `owner@acme.test` (owner), `agent@acme.test` (agent), `agent2@acme.test` (agent), `viewer@acme.test` (viewer) |
| Globex Support (`globex`) | `owner@globex.test` (owner), `agent@globex.test` (agent)                                                      |

Every account signs in with your `SEED_PASSWORD`; the seed stops if it isn't set. Re-running
it is safe: it restores the fixture tickets and roles.

### 9. Check and start

```bash
npx aiden doctor   # config, required env vars, CVE scan, npm audit, ThemeProvider wiring
npm run dev        # merges the schema, then starts http://localhost:3000
```

Sign in at `/login` with any seeded account. [docs/evidence/aiden-doctor.md](docs/evidence/aiden-doctor.md)
shows a green run.

### 10. Tests

```bash
npm test                    # Vitest: unit tests + route tests against the local database
scripts/security-smoke.sh   # curl perimeter suite, against a running npm run dev
```

Route tests run against your local database (reseeded first, cleaned up after). Sign-in and
the AI provider are mocked, so tests never call a real model.

---

## Switch the AI provider

All AI calls go through one client, `defaultAI()` in `src/lib/ai.ts`, built from the `ai`
block of `aiden.config.ts`. No route names a provider, so switching is a config change with
no code edits.

```ts
// aiden.config.ts
ai: {
  defaultProvider: "anthropic",   // ← the switch: which provider the app uses
  providers: {
    openai: false,                // ← each provider used must be enabled here
    anthropic: false,
    // google, mistral, groq, cohere
  },
  models: {
    openai: "gpt-4o-mini",        // the model used for each provider
    anthropic: "claude-haiku-4-5",
    // …
  },
},
```

> **AI is off in the committed config** (every provider is `false`). Tickets are created
> without triage, and **Draft reply** shows an error. Turn a provider on to use AI.

**Turn on Anthropic** (the default provider):

1. Set `providers.anthropic: true`.
2. Put `ANTHROPIC_API_KEY` in `.env.local`. Its SDK, `@anthropic-ai/sdk`, is already installed.
3. Restart `npm run dev`. `npx aiden doctor` now also requires `ANTHROPIC_API_KEY`.

**Add a second provider**, e.g. OpenAI, once:

1. `npm install openai` (provider SDKs are optional peer dependencies of `aiden-ai`).
2. Set `providers.openai: true` and add `OPENAI_API_KEY` to `.env.local`.

**Switch** with both enabled: change the one line, then restart.

```ts
defaultProvider: "openai",
```

Triage and drafting use the new provider, and `/admin/cost` shows its model under
**By model**. To change only the model, edit `models.<provider>`.

If `defaultProvider` names a provider that isn't enabled, AI calls fail with
`ai.defaultProvider "<name>" is not enabled in aiden.config.ts ai.providers.` rather than
silently using another one.

---

## Audit trail

Routes record events such as `ticket.create`, `ai.classify` and `member.role_change` with
`auditLog()`. `aiden-security` adds the denials (`security.ownership_failed`,
`security.ability_denied`) and `aiden-auth` adds sign-ins. `audit.sink` in `aiden.config.ts`
picks where they go:

| `audit.sink`         | Destination                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `"prisma"` (default) | The `audit_logs` table, which owners read at `/admin/audit`                                                                               |
| `"file"`             | JSON Lines at `AUDIT_LOG_FILE`, for an audit store and retention policy the customer owns. `/admin/audit` stays empty while it's selected |

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
- `scripts/security-smoke.sh`: the same perimeter over curl against `npm run dev`, 30 graded rows

Latest results are in [docs/evidence/](docs/evidence/).

## Not included

- **Live AI evidence** (`AIUsage` rows in Prisma Studio, a captured SSE draft, the injection
  probe against a real model). AI is off in the committed config because of SDK limitations
  agreed with the tester. Both AI features are covered by tests against a fake client.
- **CI** (Professional tier). The dev-vs-CI migration split is documented in
  [Migrations](#7-migrations-npm-run-dbmigrate-vs-aiden-migrate).

## Upgrading AIDEN

Never hand-edit `@upstart13-com/aiden-*` versions. Use:

```bash
aiden upgrade --dry-run   # preview
aiden upgrade             # needs a clean working tree; commits the result
```

See [docs/ops-diagnosis.md](docs/ops-diagnosis.md) for why an upgrade can do nothing and how
to recover from a bad one.
