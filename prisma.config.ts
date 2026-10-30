import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({ path: ".env.local" });

// Placeholder lets `prisma generate` (postinstall) run before the customer
// sets DATABASE_URL. Migrate / runtime queries still fail loudly without it.
const url =
  process.env.DATABASE_URL ??
  "postgresql://placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  // Prisma 7 reads the seed command from HERE, not from the `prisma.seed`
  // field in package.json, which it silently ignores. See .claude/fixes/prisma.md.
  migrations: { path: "prisma/migrations", seed: "npx tsx prisma/seed.ts" },
  datasource: { url },
});
