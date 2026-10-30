# Evidence: security smoke suite

[`scripts/security-smoke.sh`](../../scripts/security-smoke.sh) is the curl suite from plan §8.2.
Each persona signs in for real through the credentials provider, with its own cookie jar, and
every row asserts an exact status code. The script exits non-zero on any mismatch.

```bash
npm run dev                     # in another terminal
scripts/security-smoke.sh       # reads SEED_PASSWORD from .env.local; BASE=http://localhost:3000
```

Captured on 2026-10-30 15:44 against `npm run dev` with the seeded fixtures:

```
Security smoke suite → http://localhost:3000

Authentication
  ✓ 1   anonymous GET /api/tickets                                     401
  ✓ 2   anonymous GET /api/tickets/{acme}                              401

Visibility
  ✓ 3   acme owner lists tickets, every row in acme                    200
  ✓ 4   acme owner reads agent2's ticket                               200
  ✓ 8   acme agent reads agent2's ticket (same org)                    404
  ✓ 9   acme agent reads own ticket                                    200
  ✓ 10  acme agent reads assigned ticket                               200
  ✓ 14  acme viewer reads a ticket                                     200

Cross-tenant (always 404, never 403)
  ✓ 5   globex owner GET acme ticket                                   404
  ✓ 6   globex agent PATCH acme ticket                                 404
  ✓ 7   globex agent closes acme ticket                                404
  ✓ 18  globex owner PATCH acme member                                 404

Capabilities (403)
  ✓ 11  acme viewer PATCH ticket                                       403
  ✓ 12  acme viewer creates ticket                                     403
  ✓ 13  acme viewer requests AI draft                                  403
  ✓ 15  acme agent GET /api/admin/members                              403
  ✓ 16  acme agent GET /api/admin/audit                                403
  ✓ 17  acme agent GET /api/admin/usage                                403

Validation and tenancy
  ✓ 19  acme owner POST /api/tickets with {}                           400
  ✓ 20  acme agent create with globex orgId lands in acme              201

Admin
  ✓ 21  acme owner reads audit, only acme actors                       200
  ✓ 22  acme owner reads usage                                         200
  ✓ 23  acme owner demotes the only owner                              400

Rate limit
  ✓ 24  11th rapid draft request                                       429

24 passed, 0 failed
```

## What the rows prove

| Status | Rows         | Meaning                                                                                                       |
| ------ | ------------ | ------------------------------------------------------------------------------------------------------------- |
| 401    | 1, 2         | No session, no data                                                                                           |
| 400    | 19, 23       | Zod rejects a bad body; the org can't lose its last owner                                                     |
| 403    | 11–13, 15–17 | A role that can see the resource but may not do the action                                                    |
| 404    | 5–8, 18      | Another org's ticket or member, and another agent's ticket in the same org. Never 403, so ids can't be probed |
| 429    | 24           | Draft requests are rate-limited to 10 a minute per user                                                       |

Row 20 shows tenancy is structural: the client sends a globex `orgId`, and the ticket still
lands in acme, because `orgId` is never part of a request schema.

With AI off, rows 13 and 24 still hold: the role check and the rate limit both run before any
provider call. Row 20 leaves one closed "Smoke row 20" ticket in acme on each run;
`npm run db:seed` does not remove it.
