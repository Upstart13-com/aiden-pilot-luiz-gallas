# Evidence: `aiden doctor`

`aiden doctor` from `@upstart13-com/aiden-cli` 2.0.1, captured on 2026-10-30 15:37. ANSI colours are stripped.

## 1. Before `npm run dev` (current config)

`aiden.config.ts` has every AI provider turned off, so only `DATABASE_URL` and `AUTH_SECRET`
are required.

```
aiden doctor

1. aiden.config
   ✓ /Users/luizgallas/Documents/projects/upstart/deskline/aiden.config.ts valid (v2.0.1)

2. Environment variables
   ✓ all 2 required vars present

3. CVE scan (osv-scanner)
   ✓ no vulnerabilities found

4. npm audit (high/critical only)
   ✓ clean

5. SDK wiring
   ✓ <ThemeProvider> mounted in root layout

All checks passed.
```

## 2. After a config change: Anthropic turned on

`providers.anthropic` set to `true` in `aiden.config.ts`. Doctor now also requires
`ANTHROPIC_API_KEY` (3 required variables instead of 2) and finds it in `.env.local`. The change
was reverted after this run, so AI stays off in the committed config.

```
aiden doctor

1. aiden.config
   ✓ /Users/luizgallas/Documents/projects/upstart/deskline/aiden.config.ts valid (v2.0.1)

2. Environment variables
   ✓ all 3 required vars present

3. CVE scan (osv-scanner)
   ✓ no vulnerabilities found

4. npm audit (high/critical only)
   ✓ clean

5. SDK wiring
   ✓ <ThemeProvider> mounted in root layout

All checks passed.
```

## What each check covers

| #   | Check                 | Reads                                                                             |
| --- | --------------------- | --------------------------------------------------------------------------------- |
| 1   | `aiden.config`        | Schema-validates `aiden.config.ts` and reports its version                        |
| 2   | Environment variables | The variables the enabled features need, e.g. one API key per enabled AI provider |
| 3   | CVE scan              | `osv-scanner` against `package-lock.json`                                         |
| 4   | npm audit             | High and critical advisories only                                                 |
| 5   | SDK wiring            | `<ThemeProvider>` from `aiden-ui` mounted in the root layout                      |
