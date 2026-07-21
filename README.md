# C21JFC Conference — Registration & Payment

Registration and payment for the One21 Conference,
**February 27, 2027**. Next.js + Postgres + CSG Forte.

---

## The calendar

Every date lives in `lib/config.ts`. Change it there and the form, the cron,
the emails, and the admin dashboard all follow.

| | |
|---|---|
| Registration opens | Tue, Sep 1, 2026 |
| **Last day to choose the 3-payment plan** | **Sun, Nov 15, 2026** |
| Payment 2 of 3 charges | Wed, Dec 16, 2026 |
| Payment 3 of 3 charges | Fri, Jan 15, 2027 |
| **Deadline — paid in full** | **Thu, Jan 28, 2027** |
| Conference begins | Sat, Feb 27, 2027 |

The 13-day gap between the final installment and the deadline is deliberate. A
card that fails on Jan 15 gets retried on the 18th and the 22nd, with a call
from Rebecca in between, and there is still time to cancel cleanly.

## The model

- **Pay in full — $690.** Charged today. Confirmed immediately.
- **3 payments of $230.** Charged today, Dec 16, Jan 15. No premium.
  Seat is **Reserved**, not Confirmed, until the final payment clears.
- **The 3-pay option closes Nov 15** — enforced as a date check in
  `installmentsAvailable()`, in the UI *and* server-side. Never trust the client.
- **Seats are purchased only at `paid_in_full`**, in a Monday batch. Zero cash
  exposure: C21JFC never fronts money for an agent who hasn't paid.

## What each of last year's problems maps to

| Last year | Fix |
|---|---|
| Registration code confusion | No codes. A unique link per registration. |
| Missing agents on attendee lists | The form creates a row **before** payment. Everyone who intends to come exists in the DB from minute one. |
| Agents needing help registering | Rebecca in the footer of every page and every email. |
| Manual registration workarounds | Nothing to work around — one form, one flow. |
| Payment tracking complications | `/admin` is live. The CSV export is the attendee list. |

## Setup

```bash
npm install
cp .env.example .env.local     # fill in Forte SANDBOX credentials
psql $DATABASE_URL -f db/schema.sql
npm run dev
```

Deploy to Vercel. Set the env vars, and confirm the two crons in `vercel.json`
are registered.

## Before you flip to production

1. **Confirm the fee model with your Forte rep.** If the MID is on the
   **convenience fee** model, stored cards and auto-billing may be restricted —
   which breaks the 3-pay plan entirely. You need the **absorbed fee** model.
2. **Re-verify every Forte v3 field name and response shape** against the
   current docs. UAT and production have differed before.
3. **Turn on webhook signature verification.** `verify()` in
   `app/api/forte/webhook/route.ts` is stubbed against
   `FORTE_WEBHOOK_SECRET` — confirm the exact scheme Forte uses for your
   account.
4. **Gate `/admin`.** It is wide open as written. Put it behind M365 SSO.
5. **Fill in the RSM → email map** in `app/api/cron/seat-batch/route.ts`.
6. **Check the descriptor** on your Forte MID. Agents will call about a $230
   charge; it needs to say something they recognize.

## The one rule

`CONSENT_INSTALLMENT` in `lib/config.ts` is stored verbatim in the `consents`
table with the agent's IP and timestamp, and it **must match the Registration
Packet word for word**. If the two ever drift, the chargeback defense weakens.
Change one, change both.
