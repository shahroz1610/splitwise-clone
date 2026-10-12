# Split — a Splitwise clone for one group

Track shared expenses for a single group: add people, log expenses with four split methods,
see who owes whom (with **simplify debts**), record settle-up payments, and browse activity and spending charts.

Built with Next.js (App Router), Tailwind CSS, Recharts and Supabase (Postgres).

## Features

- **Expenses** — description, amount, payer, date, category, notes. Split **equally**, by **exact amounts**,
  **percentages**, or **shares**, with a live per-person preview. Edit and delete. Search and filter by category/person.
- **Balances** — total balance per person and a "who owes whom" list. **Simplify debts** toggle minimises the number
  of payments (greedy largest-debtor ↔ largest-creditor matching, at most _n − 1_ payments); off shows plain pairwise debts.
- **Settle up** — record a payment between two people; one-click "Settle" on any debt prefills it.
- **People** — add, rename, delete (if they have no history) or archive (once settled up) members.
- **Viewing as** — pick yourself (remembered per browser) to see "you owe / you are owed / you lent / you borrowed".
- **Activity feed** — every change is logged with who made it.
- **Insights** — spending by category, by month, and paid-vs-share per person; whole group or just your share.
- **Settings** — group name, display currency, simplify-debts default, lock/unlock editing.

## How data access works (no auth)

- The browser never talks to Supabase. All reads and writes go through Next.js route handlers in `src/app/api/`,
  which use the **service role key** server-side.
- RLS is enabled on every table with **no policies**, so the public anon key can't read or write anything.
- **Anyone with the link can view.** Writes require the `GROUP_PASSCODE`; entering it once sets an httpOnly cookie
  (an HMAC of the passcode) on that device. If `GROUP_PASSCODE` is empty, anyone can edit.
- Money is stored as integer cents. Split amounts are computed on the server and saved atomically through the
  `save_expense` Postgres function, which also checks that shares add up to the total.

## Setup

1. **Create a Supabase project**, open the SQL editor, and run [`supabase/schema.sql`](supabase/schema.sql).
2. **Configure env vars**: copy `.env.example` to `.env.local` and fill in `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY` and `GROUP_PASSCODE`.
3. **Run locally**:
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000, go to **People** and add everyone in the group.

## Deploy to Vercel

1. Push this folder to a Git repo and import it in Vercel (framework preset: Next.js — no extra config needed).
2. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `GROUP_PASSCODE` under **Project → Settings → Environment Variables**.
3. Deploy, then share the URL and the passcode with the group.

## Project layout

```
supabase/schema.sql          tables, RLS, save_expense()
src/lib/splits.ts            split maths (largest-remainder rounding)
src/lib/balances.ts          net balances, pairwise debts, simplify debts
src/lib/server/              Supabase client, passcode check, validation, data loading
src/app/api/                 route handlers (state, expenses, payments, members, settings, unlock)
src/components/              client UI: store (context), dialogs, expense form, tabs
```
