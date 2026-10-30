#!/usr/bin/env bash
# Graded security smoke suite (plan §8.2). Runs against a live `npm run dev`
# and exits non-zero on any mismatch.
#
#   SEED_PASSWORD=… scripts/security-smoke.sh            # BASE defaults to http://localhost:3000
#
# Needs the seeded fixtures (`npm run db:seed`), curl and jq. Each persona signs
# in for real through the credentials provider, with its own cookie jar.
# Row 20 creates one ticket ("Smoke row 20") in acme and closes it.
set -uo pipefail

BASE="${BASE:-http://localhost:3000}"
if [[ -z "${SEED_PASSWORD:-}" && -f .env.local ]]; then
  SEED_PASSWORD="$(grep -E '^SEED_PASSWORD=' .env.local | cut -d= -f2- | tr -d '"')"
fi
: "${SEED_PASSWORD:?SEED_PASSWORD is not set (export it or put it in .env.local)}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

PASS=0
FAIL=0

# Fixture ids from prisma/seed.ts
ACME_AGENT_OWNED="tkt_acme_agent_owned"       # owned by agent@acme.test
ACME_AGENT_ASSIGNED="tkt_acme_agent_assigned" # assigned to agent@acme.test
ACME_OTHER_AGENT="tkt_acme_other_agent"       # owned by agent2@acme.test

sign_in() { # persona email
  local jar="$WORK/$1.jar" csrf
  csrf="$(curl -s -c "$jar" "$BASE/api/auth/csrf" | jq -r .csrfToken)"
  curl -s -o /dev/null -b "$jar" -c "$jar" -X POST "$BASE/api/auth/callback/credentials" \
    --data-urlencode "csrfToken=$csrf" \
    --data-urlencode "email=$2" \
    --data-urlencode "password=$SEED_PASSWORD"
  if [[ "$(curl -s -b "$jar" "$BASE/api/auth/session" | jq -r '.user.email // empty')" != "$2" ]]; then
    echo "✗ could not sign in as $2 — is the database seeded with this SEED_PASSWORD?" >&2
    exit 2
  fi
}

# call persona method path [json-body] → prints status; response body in $WORK/body
call() {
  local jar=() data=()
  [[ "$1" != anonymous ]] && jar=(-b "$WORK/$1.jar")
  [[ -n "${4:-}" ]] && data=(-H "Content-Type: application/json" --data "$4")
  # ${a[@]+…} keeps empty arrays safe under `set -u` in macOS's bash 3.2
  curl -s -o "$WORK/body" -w '%{http_code}' ${jar[@]+"${jar[@]}"} -X "$2" ${data[@]+"${data[@]}"} "$BASE$3"
}

# check row description expected actual [extra-condition-ok]
check() {
  local ok="${5:-true}"
  if [[ "$4" == "$3" && "$ok" == true ]]; then
    PASS=$((PASS + 1))
    printf '  ✓ %-3s %-62s %s\n' "$1" "$2" "$4"
  else
    FAIL=$((FAIL + 1))
    printf '  ✗ %-3s %-62s expected %s, got %s%s\n' "$1" "$2" "$3" "$4" \
      "$([[ "$ok" != true ]] && echo " ($ok)")"
  fi
}

# jq condition over the last response body → "true" or a short reason
holds() { jq -e "$1" "$WORK/body" >/dev/null 2>&1 && echo true || echo "${2:-body check failed}"; }

echo "Security smoke suite → $BASE"
for p in acme_owner:owner@acme.test acme_agent:agent@acme.test acme_viewer:viewer@acme.test \
  globex_owner:owner@globex.test globex_agent:agent@globex.test; do
  sign_in "${p%%:*}" "${p#*:}"
done

ACME_ORG="$(call acme_owner GET /api/me >/dev/null; jq -r .membership.orgId "$WORK/body")"
call acme_owner GET /api/admin/members >/dev/null
cp "$WORK/body" "$WORK/acme-members"
ACME_OWNER_MEMBER="$(jq -r '.members[] | select(.email == "owner@acme.test") | .id' "$WORK/acme-members")"
ACME_AGENT_MEMBER="$(jq -r '.members[] | select(.email == "agent@acme.test") | .id' "$WORK/acme-members")"

echo
echo "Authentication"
check 1 "anonymous GET /api/tickets" 401 "$(call anonymous GET /api/tickets)"
check 2 "anonymous GET /api/tickets/{acme}" 401 "$(call anonymous GET "/api/tickets/$ACME_AGENT_OWNED")"

echo
echo "Visibility"
s="$(call acme_owner GET /api/tickets)"
check 3 "acme owner lists tickets, every row in acme" 200 "$s" \
  "$(holds "[.tickets[].orgId] | all(. == \"$ACME_ORG\")" "a row outside acme")"
check 4 "acme owner reads agent2's ticket" 200 "$(call acme_owner GET "/api/tickets/$ACME_OTHER_AGENT")"
check 8 "acme agent reads agent2's ticket (same org)" 404 "$(call acme_agent GET "/api/tickets/$ACME_OTHER_AGENT")"
check 9 "acme agent reads own ticket" 200 "$(call acme_agent GET "/api/tickets/$ACME_AGENT_OWNED")"
check 10 "acme agent reads assigned ticket" 200 "$(call acme_agent GET "/api/tickets/$ACME_AGENT_ASSIGNED")"
check 14 "acme viewer reads a ticket" 200 "$(call acme_viewer GET "/api/tickets/$ACME_AGENT_OWNED")"

echo
echo "Cross-tenant (always 404, never 403)"
check 5 "globex owner GET acme ticket" 404 "$(call globex_owner GET "/api/tickets/$ACME_AGENT_OWNED")"
check 6 "globex agent PATCH acme ticket" 404 \
  "$(call globex_agent PATCH "/api/tickets/$ACME_AGENT_OWNED" '{"subject":"pwned"}')"
check 7 "globex agent closes acme ticket" 404 "$(call globex_agent POST "/api/tickets/$ACME_AGENT_OWNED/close")"
check 18 "globex owner PATCH acme member" 404 \
  "$(call globex_owner PATCH "/api/admin/members/$ACME_AGENT_MEMBER" '{"role":"viewer"}')"

echo
echo "Capabilities (403)"
check 11 "acme viewer PATCH ticket" 403 "$(call acme_viewer PATCH "/api/tickets/$ACME_AGENT_OWNED" '{"subject":"x"}')"
check 12 "acme viewer creates ticket" 403 \
  "$(call acme_viewer POST /api/tickets '{"subject":"x","body":"Viewer should not create this."}')"
check 13 "acme viewer requests AI draft" 403 "$(call acme_viewer POST "/api/tickets/$ACME_AGENT_OWNED/draft" '{}')"
check 15 "acme agent GET /api/admin/members" 403 "$(call acme_agent GET /api/admin/members)"
check 16 "acme agent GET /api/admin/audit" 403 "$(call acme_agent GET /api/admin/audit)"
check 17 "acme agent GET /api/admin/usage" 403 "$(call acme_agent GET /api/admin/usage)"

echo
echo "Validation and tenancy"
check 19 "acme owner POST /api/tickets with {}" 400 "$(call acme_owner POST /api/tickets '{}')"
GLOBEX_ORG="$(call globex_owner GET /api/me >/dev/null; jq -r .membership.orgId "$WORK/body")"
s="$(call acme_agent POST /api/tickets \
  "{\"orgId\":\"$GLOBEX_ORG\",\"subject\":\"Smoke row 20\",\"body\":\"Client-supplied orgId must be ignored.\"}")"
check 20 "acme agent create with globex orgId lands in acme" 201 "$s" \
  "$(holds ".ticket.orgId == \"$ACME_ORG\"" "orgId was not acme")"
NEW_TICKET="$(jq -r '.ticket.id // empty' "$WORK/body")"
[[ -n "$NEW_TICKET" ]] && call acme_agent POST "/api/tickets/$NEW_TICKET/close" >/dev/null

echo
echo "Admin"
s="$(call acme_owner GET /api/admin/audit)"
check 21 "acme owner reads audit, only acme actors" 200 "$s" \
  "$(holds "[.entries[].actorId] - [$(jq -c '[.members[].userId]' "$WORK/acme-members" | tr -d '[]')] | length == 0" \
    "an actor outside acme")"
s="$(call acme_owner GET /api/admin/usage)"
check 22 "acme owner reads usage" 200 "$s"
check 23 "acme owner demotes the only owner" 400 \
  "$(call acme_owner PATCH "/api/admin/members/$ACME_OWNER_MEMBER" '{"role":"viewer"}')" \
  "$(call acme_owner GET /api/admin/members >/dev/null; holds '[.members[] | select(.role == "owner")] | length >= 1' "org lost its owner")"

echo
echo "Rate limit"
for _ in $(seq 1 10); do call acme_agent POST "/api/tickets/$ACME_AGENT_OWNED/draft" '{}' >/dev/null; done
check 24 "11th rapid draft request" 429 "$(call acme_agent POST "/api/tickets/$ACME_AGENT_OWNED/draft" '{}')"

echo
echo "$PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
