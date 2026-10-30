# Ops & Upgrade Diagnosis

How to diagnose and recover from the most common AIDEN ops failures in Deskline.
Checked against the installed `@upstart13-com/aiden-cli` **2.0.1** (`aiden upgrade` in
`dist/cli.js`); where this project hit a failure for real, the observed output is quoted.

---

## 1. The five reasons `aiden upgrade` can no-op

`aiden upgrade` runs: clean-tree check → read `aiden.config.ts` version → resolve the target
version → stop if up to date → codemods → bump `@upstart13-com/aiden-*` and install →
`prisma migrate deploy` → bump `aiden.config.ts` and commit. Each no-op below stops at a
different point.

### 1.1 Already on the latest version

Nothing to apply: the version in `aiden.config.ts` equals the latest published one.

```
Current version: 2.0.1
Target version:  2.0.1
✓ Already up to date.
```

_Observed in this project on 2026-10-30._

**Confirm:** compare the two versions.

```bash
grep -m1 'version:' aiden.config.ts
npm view @upstart13-com/aiden-ui version
```

### 1.2 A dirty working tree

The upgrade commits its result, so it refuses to start on top of uncommitted changes
(exit code 2):

```
✗ Working tree is not clean. Commit or stash before running aiden upgrade.
```

`--dry-run` skips this check, so a dry run can succeed where the real upgrade stops.

**Confirm:** `git status --porcelain` prints anything.

### 1.3 Registry or network failure

The target version comes from `npm view @upstart13-com/aiden-ui version`. If that fails, the
upgrade stops before doing anything (exit code 1):

```
✗ Could not resolve latest version from registry.
```

_Observed in this project:_ the agent shell had no `GITHUB_PAT`, so GitHub Packages answered
`401 Unauthorized`. A token without SSO authorization for the org gives a 403 that mentions
SAML instead.

**Confirm:** run the lookup directly and read the npm error.

```bash
npm view @upstart13-com/aiden-ui version   # E401 / E403 / ENOTFOUND / ETIMEDOUT
grep registry .npmrc                        # @upstart13-com → https://npm.pkg.github.com
[ -n "$GITHUB_PAT" ] && echo set || echo "GITHUB_PAT not set"
```

### 1.4 Scaffolds skipped because anchor files were customized

Scaffold codemods fingerprint the starter files they rewrite. When a file no longer matches
(you customized it), the codemod declines to overwrite it rather than clobber your changes.
The upgrade "succeeds", but that part of the change never lands. Skip reasons in 2.0.1
include `modified`, `anchor_mismatch` and `customised`; `exists` and `noop` are harmless.

**Confirm:** run a dry run and read the section the CLI prints for these files.

```bash
aiden upgrade --dry-run
# Files left untouched (manual merge may be needed):
#   · src/app/dashboard/layout.tsx (customised — pass brand={brand} to the aiden-ui chrome by hand)
```

Each listed file needs the codemod's change applied by hand. The codemod's own message, and
the package's `BREAKING.md`, say what to change.

### 1.5 An unresolved `BREAKING.md` fix-up

Each `@upstart13-com/*` package ships a `BREAKING.md` listing the manual fix-ups a release
needs. Its header states that `aiden doctor` reads it and warns about fix-ups still
unresolved since the last upgrade, and the upgrade should not proceed until they are done.

**Confirm:**

```bash
aiden doctor
ls node_modules/@upstart13-com/*/BREAKING.md
# then read the entries between your aiden.config.ts version and the target
```

> **Verification note:** in the installed 2.0.1 CLI the compiled code
> (`aiden-cli/dist/cli.js`, `dist/codemods/`) never references `BREAKING.md`, so `aiden doctor`
> does not yet surface these entries automatically. Until it does, read the `BREAKING.md`
> entries for the version range by hand before upgrading.

---

## 2. Recovery runbook

A successful `aiden upgrade` makes one commit, `chore(aiden): upgrade <from> → <to>`. A
failure during install or migrate stops **before** that commit, leaving the changes
uncommitted.

### 2.1 Drop a bad upgrade commit

```bash
git log -1 --oneline        # confirm HEAD is "chore(aiden): upgrade … → …"
git reset --hard HEAD~1     # drop the upgrade commit and its file changes
npm ci                      # put node_modules back in line with the restored lockfile
npm run prisma:generate     # regenerate the Prisma client for the restored schema
```

`git reset` does **not** undo migrations that `prisma migrate deploy` already applied.

- **Local dev database:** reset it to match the restored code, then reseed.

  ```bash
  npx prisma migrate reset --force   # destructive, local only
  ```

- **Shared or production database:** never reset it. Ship a new migration that reverses the
  change, or restore from a backup taken before the upgrade.

### 2.2 Park in-flight work, or clean up a partial upgrade

Before retrying an upgrade on a tree with work in progress:

```bash
git stash push -u -m "before aiden upgrade"   # -u includes untracked files
aiden upgrade
git stash pop
```

After an upgrade that failed mid-way (no commit was made), park its changes instead of
losing them, then restore the dependencies:

```bash
git stash push -u -m "failed aiden upgrade"
npm ci
```

> In this project, plain `npm install` crashed in npm 10.9.8's peer-dependency resolver
> (`Cannot read properties of null (reading 'edgesOut')`) and only worked with
> `--legacy-peer-deps`. If the upgrade's install step fails that way, run
> `npm install --legacy-peer-deps` by hand, then `aiden migrate`.

### 2.3 Hotfix-pin a known-good version

While you investigate, pin every `@upstart13-com/aiden-*` dependency in `package.json` to the
last known-good version, **exactly** (no `^`), so nothing resolves to the broken release:

```json
"@upstart13-com/aiden-ai": "2.0.1",
"@upstart13-com/aiden-auth": "2.0.1",
"@upstart13-com/aiden-db": "2.0.1",
"@upstart13-com/aiden-logging": "2.0.1",
"@upstart13-com/aiden-realtime": "2.0.1",
"@upstart13-com/aiden-security": "2.0.1",
"@upstart13-com/aiden-ui": "2.0.1"
```

```bash
npm install
git commit -am "chore(aiden): pin to 2.0.1 pending upgrade fix"
```

This is the one exception to "never hand-edit `@upstart13-com/aiden-*` versions": it's an
incident hotfix. Once the cause is fixed, go back to `aiden upgrade`, which restores the `^`
ranges and runs the codemods and migrations the hand edit skipped.

---

## 3. "Request context empty in prod, but works locally"

### Root cause

`withAuth` runs each handler inside `withRequestContext()`, which stores `requestId` and
`userId` in an `AsyncLocalStorage` that lives in **`@upstart13-com/aiden-logging`'s module
state**. `aiden-security` and `aiden-ai` declare `aiden-logging` as a **peer** dependency
precisely so the whole app shares one copy.

If the production install ends up with **two copies**, for example an older one nested under
`aiden-security/node_modules/`, each copy has its own `AsyncLocalStorage`. `withAuth` writes
the context into one store, and `getRequestContext()` (or the logger, or `recordAIUsage`)
reads the other, empty one. Locally a deduped `node_modules` hides the problem; a production
install from a different lockfile or package manager can expose it.

**Symptoms:** log lines missing `requestId`/`userId`; `ai_usage` and `audit_logs` rows with a
null `userId`/`actorId`; all of it only in production.

### Diagnose

```bash
npm ls @upstart13-com/aiden-logging
```

Healthy output, as in this project today: one version, everything else `deduped`.

```
deskline@0.0.0
├─┬ @upstart13-com/aiden-ai@2.0.1
│ └── @upstart13-com/aiden-logging@2.0.1 deduped
├── @upstart13-com/aiden-logging@2.0.1
└─┬ @upstart13-com/aiden-security@2.0.1
  └── @upstart13-com/aiden-logging@2.0.1 deduped
```

A problem looks like a second version listed without `deduped`, or a nested install:

```bash
find node_modules -path '*@upstart13-com/aiden-logging/package.json'   # more than one line = duplicate
```

### Fix

Dedupe:

```bash
npm dedupe
npm ls @upstart13-com/aiden-logging   # re-check: a single version
```

If the duplicate comes back, force a single version with an `overrides` entry in
`package.json`. This project already uses `overrides` the same way for `zod`.

```json
"overrides": {
  "@upstart13-com/aiden-logging": "$@upstart13-com/aiden-logging"
}
```

`$name` pins every copy to the version in your own `dependencies`. Then reinstall and re-run
`npm ls`. To stop it recurring, keep every `@upstart13-com/aiden-*` package on the same train
version, which `aiden upgrade` does.

### A related failure this project hit

The same "one store, two module instances" mechanism caused a real bug here, without a
duplicate package. The Prisma audit sink (`setAuditSink`) was registered only from
`src/instrumentation.ts`. Next loads instrumentation in a separate module graph from the route
handlers, so the routes never saw the sink and every audit event went to the log instead of
`audit_logs`. The table stayed empty. The fix was to also import `@/lib/audit` from
`src/lib/security.ts`, which every route loads. The lesson carries over: any AIDEN
module-level state (sinks, `AsyncLocalStorage`) must be set up in the same module instance
that the code reading it uses.
