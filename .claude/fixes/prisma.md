# Prisma Fixes

## 1. Always run `prisma generate` after schema changes

**Error:** `PrismaClientInitializationError` or missing types after modifying `prisma/schema.prisma`.

**Cause:** The Prisma client is code-generated from the schema. Schema changes are not reflected until regeneration.

**Fix:** Run `DATABASE_URL=... npx prisma generate` (or `npm run postinstall`) after any schema change. The `postinstall` script handles this automatically on `npm install`.

**Structurally prevented:** No — requires manual step after schema edits.

---

## 2. Prisma v7 requires `prisma.config.ts` for datasource URL

**Error:** `The datasource property 'url' is no longer supported in schema files.`

**Cause:** Prisma v7 moved datasource configuration out of `schema.prisma` into `prisma.config.ts`.

**Fix:** Keep `datasource db { provider = "postgresql" }` in schema (no `url`). The URL is configured in `prisma.config.ts` via `defineConfig({ datasource: { url: env("DATABASE_URL") } })`. The `PrismaClient` is instantiated with `@prisma/adapter-pg` in `src/lib/prisma.ts`.

**Structurally prevented:** No — but documented in schema and config files.

---

## 3. `prisma.config.ts` must load `.env.local` explicitly

**Error:** `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL.`

**Cause:** `import "dotenv/config"` only loads `.env` by default. Next.js uses `.env.local` for local overrides, but Prisma CLI runs outside of Next.js and doesn't know about `.env.local`.

**Fix:** Replace `import "dotenv/config"` with explicit path loading:

```typescript
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
```

**Structurally prevented:** Yes — `prisma.config.ts` already updated with the correct pattern.

---

## 4. Prisma 7 ignores `package.json`'s `prisma.seed` field

**Error:** `npm run db:seed` / `prisma db seed` prints the CLI help for `defineConfig` instead of running the seed, even though `package.json` contains a valid `"prisma": { "seed": "npx tsx prisma/seed.ts" }` block.

**Cause:** Prisma 7 moved seed configuration out of `package.json` and into `prisma.config.ts`. The old `prisma.seed` field is not read and not warned about — it is silently ignored, so the failure looks like a malformed command rather than missing config.

**Fix:** Declare the seed command under `migrations` in `prisma.config.ts`:

```typescript
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "npx tsx prisma/seed.ts" },
  datasource: { url },
});
```

The `prisma.seed` block in `package.json` can stay (harmless) or be removed.

**Structurally prevented:** Yes — `prisma.config.ts` now carries the seed command with a comment pointing here.

---

## 5. Stale generated client after a schema change breaks `upsert` compound keys

**Error:** `PrismaClientValidationError: Invalid prisma.membership.upsert() invocation` — the `where` rejects `userId_orgId` and suggests `orgId_userId`, and an enum field is typed `StringFilter | String` instead of the enum.

**Cause:** `prisma migrate dev` applied the migration and reported "Your database is now in sync with your schema", but `src/generated/prisma/` was still the client generated from the *previous* schema. The compound-unique accessor is named after the field order in `@@unique([...])`, so reordering or redefining it renames the key — and the stale client still exports the old name. The error names a real accessor, which makes it read like a field-order mistake in your code rather than a stale artifact.

**Fix:** Run `npm run prisma:generate` (merge + generate) after any fragment change, before running code that uses the client. `migrate dev` does not reliably regenerate into a consumer-output path.

**Structurally prevented:** No — remember to regenerate. `npm run dev` and `npm run build` both merge first, so this mainly bites standalone scripts such as `prisma/seed.ts`.
