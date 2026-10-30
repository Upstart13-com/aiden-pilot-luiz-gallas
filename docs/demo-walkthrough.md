# Demo walkthrough

A script for a 10-minute live demo or screen recording. Each step says what to do and what
the audience should see.

## Before you start

```bash
docker compose up -d
npm run db:seed        # resets the fixture tickets and roles
aiden doctor           # all checks green
npm run dev            # http://localhost:3000
```

AI must be on for steps 2, 3 and 7: set `providers.anthropic: true` in `aiden.config.ts` and
`ANTHROPIC_API_KEY` in `.env.local` before `npm run dev`. The committed config has AI off.

Have two browser windows ready (one normal, one private) and a terminal in the project folder.
All seeded accounts use your `SEED_PASSWORD`.

---

## 1. Register and sign in

1. Open `http://localhost:3000`, then **Create an account**, and register any new email.
2. You land on the dashboard with **"You're not part of an organization yet"**. New accounts
   don't belong to an org until an owner adds them (step 6); nothing in another org is visible.
3. Sign out, then sign in as **`agent@acme.test`**.

**Shows:** the auth forms from `aiden-auth`, and an account with no org seeing nothing.

## 2. Create a ticket → automatic triage

1. On **Tickets**, click **New ticket**.
2. Subject: `Charged twice for my subscription`.
   Description: `I was billed twice this month and I'm really frustrated. Please refund one charge.`
3. Click **Create ticket**.

**Shows:** you land on the new ticket. The toast says triage set its priority and category, and
**Priority**, **Category** and **Sentiment** are filled in (for example High / Billing /
Negative). Those come from one `ai.complete({ responseSchema })` call, validated with Zod
before saving.

## 3. Streamed draft reply

1. Open the **AI draft** tab.
2. Pick **Tone: Apologetic** and click **Draft reply**.

**Shows:** the reply appears token by token while "Drafting…" shows; then **Copy** and
**Regenerate** appear. Under the hood: `createAIStreamResponse` on the server, `useAIStream`
in the browser, server-sent events only.

Optional, the raw stream in the terminal (copy your session cookie from the browser's dev
tools first):

```bash
curl -N -X POST http://localhost:3000/api/tickets/tkt_acme_agent_owned/draft \
  -H "Content-Type: application/json" -H "Cookie: authjs.session-token=…" \
  -d '{"tone":"concise"}'
# data: {"delta":"Hi"} … event: done
```

## 4. A viewer is denied (403)

1. In the private window, sign in as **`viewer@acme.test`**.
2. Open any acme ticket: it's readable, but there's no **Close ticket** button and no **AI draft** tab.
3. Show the API refusing anyway. In the viewer window's dev-tools console:

   ```js
   (
     await fetch("/api/tickets/tkt_acme_agent_owned/draft", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: "{}",
     })
   ).status;
   // 403
   ```

**Shows:** viewers can read but not change tickets or use AI, enforced by the API's role
check, not just hidden in the UI.

## 5. Cross-tenant access is a 404

1. Still as the viewer, or as `owner@globex.test`, sign in to globex and open
   `http://localhost:3000/dashboard/tickets/tkt_acme_agent_owned`.
2. As `owner@globex.test` you get the **404** page.
3. The API answers the same way. In the console:

   ```js
   (await fetch("/api/tickets/tkt_acme_agent_owned"))
     .status // 404
     (await fetch("/api/tickets/does-not-exist")).status; // 404
   ```

**Shows:** another org's ticket and a ticket that doesn't exist give identical 404s, so ids
can't be probed. The tenant filter is in the query, and `assertOwnership` turns "no row" into
the 404.

## 6. Admin: members, audit, cost

Sign in as **`owner@acme.test`**. The sidebar now shows **Members**, **Audit** and **Cost**.

1. **Members:** click **Add member**, enter the email you registered in step 1 and pick
   **Agent**. The new account now sees acme's tickets. Then change **Avery Agent** to **Viewer**. A confirmation appears because it's a
   demotion. Confirm, then set them back to **Agent** (no confirmation for a promotion). Your
   own row can't be changed.
2. **Audit:** the role changes, the ticket you created, the draft requests and the viewer's
   denied request (`security.ability_denied`) are all listed, only for acme members. Filter by
   **Event: member.role_changed**.
3. **Cost:** spend for the triage and draft calls from steps 2–3, broken down by member,
   feature and model, plus the recent calls.

**Shows:** owner-only admin pages, the audit trail and AI cost telemetry, all scoped to the
owner's org.

## 7. Live one-line provider switch

1. In `aiden.config.ts`, change `defaultProvider: "anthropic"` to `"openai"` and set
   `providers.openai: true` (with `openai` installed and `OPENAI_API_KEY` in `.env.local`).
2. Restart `npm run dev`.
3. As `agent@acme.test`, create another ticket and draft a reply.

**Shows:** triage and drafting now run on the other provider with no route changes. **Cost**
shows the new model under **By model**. Switch back afterwards.

---

## Reset after the demo

```bash
npm run db:seed
```
