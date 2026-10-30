# Evidence: `aiden upgrade --dry-run`

Captured on 2026-10-30 15:37 with `@upstart13-com/aiden-cli` 2.0.1. ANSI colours are stripped.

```
aiden upgrade (dry-run)

Current version: 2.0.1
Target version:  2.0.1
✓ Already up to date.
```

The project is already on the latest AIDEN release, so the dry run stops at step 4.

## The 8 steps of `aiden upgrade`

Read from the CLI source (`upgrade()` in `aiden-cli/dist/cli.js`).

| #   | Step                 | What it does                                                                                                                                                               | Under `--dry-run`                            |
| --- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 1   | Clean-tree check     | Refuses to run on uncommitted changes (`✗ Working tree is not clean…`, exit 2), because step 8 commits                                                                     | **Skipped**                                  |
| 2   | Read current version | `version` from `aiden.config.ts`                                                                                                                                           | Runs                                         |
| 3   | Resolve target       | `--target <version>`, otherwise `npm view @upstart13-com/aiden-ui version`. A registry failure stops here (exit 1)                                                         | Runs                                         |
| 4   | Compare              | Current ≥ target prints `✓ Already up to date.` and exits 0. **This run stopped here.**                                                                                    | Runs                                         |
| 5   | Codemods             | Runs every codemod registered between the two versions (jscodeshift transforms and scaffolds). Scaffolds skip files that were customised and list them as "left untouched" | Reports what it would change, writes nothing |
| 6   | Bump and install     | Sets every `@upstart13-com/aiden-*` dependency to the target, then runs the detected package manager's install                                                             | Printed as "Would bump…" / "Would install…"  |
| 7   | Migrate              | `prisma migrate deploy --schema prisma/schema.prisma` (the same as `aiden migrate`). `--skip-migrate` skips it                                                             | Printed as "Would run prisma migrate deploy" |
| 8   | Stamp and commit     | Writes the target into `aiden.config.ts`, stages everything and commits `chore(aiden): upgrade <from> → <to>`. `--skip-commit` skips the commit                            | Printed as "Would bump… / Would commit"      |

A failure in step 6 or 7 stops before step 8, so a broken upgrade leaves uncommitted changes
rather than a commit. See [docs/ops-diagnosis.md](../ops-diagnosis.md) for the five reasons an
upgrade does nothing and the recovery runbook.
