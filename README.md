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
- **Personal view** — everything is shown from the signed-in member's side: "you owe / you are owed / you lent / you borrowed".
- **Activity feed** — every change is logged with who made it.
- **Insights** — spending by category, by month, and paid-vs-share per person; whole group or just your share.
- **Settings** — group name, display currency, simplify-debts default, account / sign out.

## Access: Google sign-in + one-time passcode

- **Everything is behind Google sign-in** (Supabase Auth). Signed-out visitors only see the sign-in screen.
- **First sign-in = sign-up.** A Google account that isn't linked to a group member must enter the
  `GROUP_PASSCODE` once, then either claim an existing (not-yet-claimed) member or join as a new one.
  The link is stored in `members.auth_user_id`, so every later visit is just "Continue with Google".
- **Only joined members can see or change data.** Archiving or deleting a member revokes their access
  (restoring them gives it back). You can't remove yourself.
- If `GROUP_PASSCODE` isn't set, nobody new can join.
- The browser never talks to Supabase. Sign-in runs through `/auth/login` → Google → `/auth/callback`
  on the server, sessions live in httpOnly cookies (refreshed by `src/proxy.ts`), and all data goes through
  the route handlers in `src/app/api/`, which use the **service role key**. RLS is on with no policies,
  so the anon key can't read or write any table.
- Activity is attributed to the signed-in member on the server; the client can't spoof it.
- Money is stored as integer cents. Split amounts are computed on the server and saved atomically through the
  `save_expense` Postgres function, which also checks that shares add up to the total.

## Setup

1. **Create a Supabase project**, open the SQL editor, and run [`supabase/schema.sql`](supabase/schema.sql).
   (Already ran an older schema? Run [`supabase/migrations/002_google_auth.sql`](supabase/migrations/002_google_auth.sql) instead.)
2. **Create Google OAuth credentials** — Google Cloud Console → APIs & Services → Credentials →
   *Create OAuth client ID* (type: Web application). Add this **Authorized redirect URI**:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. **Enable Google in Supabase** — Authentication → Sign In / Providers → Google: paste the client ID and secret.
4. **Allow your app's callback** — Authentication → URL Configuration: set *Site URL* to your production URL and add
   `http://localhost:3000/auth/callback` and `https://<your-app>.vercel.app/auth/callback` to *Redirect URLs*.
5. **Configure env vars**: copy `.env.example` to `.env.local` and fill in all four values.
6. **Run locally**:
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000, sign in with Google, enter the passcode, and join. Then add the others in **People**
   (they can claim their entry when they first sign in) or just share the link and passcode.

## Deploy to Vercel

1. Push this folder to a Git repo and import it in Vercel (framework preset: Next.js — no extra config needed).
2. Add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `GROUP_PASSCODE` under
   **Project → Settings → Environment Variables**.
3. Deploy, make sure the Vercel URL's `/auth/callback` is in Supabase's Redirect URLs (step 4 above), then share
   the URL and the passcode with the group.

## Project layout

```
supabase/schema.sql          tables, RLS, save_expense()
src/lib/splits.ts            split maths (largest-remainder rounding)
src/lib/balances.ts          net balances, pairwise debts, simplify debts
src/proxy.ts                 refreshes the Supabase Auth session cookie on API requests
src/app/auth/                Google sign-in, OAuth callback, sign-out
src/lib/server/              Supabase clients, viewer lookup, join passcode, validation, data loading
src/app/api/                 route handlers (state, join, expenses, payments, members, settings)
src/components/              client UI: store (context), sign-in/join screen, dialogs, expense form, tabs
```
