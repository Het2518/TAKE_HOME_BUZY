# Project & Task Tracker

Internal tool for tracking projects, tasks, assignments, and deadlines across a portfolio of
client work. Built with Next.js (JavaScript, App Router), PostgreSQL, and Prisma.

> This app was built to satisfy a 10-goal take-home brief. See `docs/` for the architecture,
> schema, plan, decisions, and AI-usage log — those documents are as important to this
> submission as the code itself. **Fill them in yourself, as you commit, in your own words** —
> they are what gets discussed in the follow-up interview.

## Stack

- **Framework:** Next.js 14 (App Router), plain JavaScript
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Auth:** JWT in an httpOnly cookie, bcrypt password hashing
- **Charts:** Recharts

## Local setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up the database**
   - Create a free Postgres instance (e.g. [Supabase](https://supabase.com)) or run Postgres locally.
   - Copy `.env.example` to `.env` and fill in `DATABASE_URL` and a random `JWT_SECRET`:
     ```bash
     cp .env.example .env
     ```

3. **Run migrations and generate the Prisma client**
   ```bash
   npx prisma migrate dev --name init
   ```

4. **Seed demo data**
   ```bash
   npm run seed
   ```
   This creates:
   | Role | Email | Password |
   |---|---|---|
   | Manager | manager@demo.com | Password123! |
   | Member | alice@demo.com | Password123! |
   | Member | bob@demo.com | Password123! |

5. **Run the dev server**
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000`.

## Project structure

```
prisma/            Prisma schema, migrations, seed script
src/app/            Next.js routes (pages) and API routes
src/app/api/        Server-side logic — this IS the backend, colocated with the frontend
src/lib/            Shared server logic: auth, permissions, state machine, audit logging, validation
src/components/     (add UI components here as you refactor pages into smaller pieces)
src/hooks/          Shared client-side hooks
docs/               The five required documentation files
```

## Deployment (free tier)

1. **Database:** create a Supabase project, copy its connection string into `DATABASE_URL` on your host.
2. **App:** deploy this repo to Vercel, set `DATABASE_URL` and `JWT_SECRET` as environment variables in the Vercel project settings.
3. After first deploy, run `npx prisma migrate deploy` against the production database (via a one-off script, a Vercel build step, or locally pointed at the prod `DATABASE_URL`), then run the seed script once.

## What's implemented

All 10 required goals from the brief — see `SUBMISSION.md` for the honest, filled-in checklist,
and `docs/architecture.md` for how the pieces fit together.

### Stretch features (attempt only after the 10 core goals are solid and documented)

- **Cycle detection on task blockers** (`src/lib/taskStateMachine.js#wouldCreateCycle`) —
  DFS over the "what depends on this task" graph; enforced on every `PATCH /api/tasks/:id`
  that changes `blockingTaskIds`, rejecting an edge that would create a circular dependency.
- **Drag-and-drop board** (`/board`) — reuses `PATCH /api/tasks/:id/status` exactly as the
  detail page's buttons do, so every legality/blocking check is already enforced; dropping
  a card on an illegal column surfaces the same server error.
- **Saved filter views** (`SavedFilter` model, `/api/saved-filters`) — stores a user's named
  filter/sort combination in the exact query-param shape `GET /api/tasks` already accepts.
- **Cross-project activity feed** (`/activity`, `/api/activity`) — queries the same `TaskEvent`
  table goal 9 requires, across every visible project instead of one task, with pagination.

Not implemented (deliberately, per the effort-vs-payoff trade-off — see `docs/decisions.md`):
email digests (needs cron + a transactional email service, real infra not otherwise needed)
and per-project custom fields (real schema/normalization trade-offs, higher effort than value
for this scope).

## UI

- Light/dark theme, toggle in the nav, persisted to `localStorage`. No flash of the wrong
  theme on load (set via an inline script in `src/app/layout.js` before React hydrates).
- Search on the All Tasks page is debounced (350ms) — typing doesn't fire a network request
  per keystroke.
- Task status changes are optimistic: the UI updates the instant you click, and rolls back
  only if the server rejects the change.

## Tests

```bash
npm test
```

49 tests covering the task state machine exhaustively (pure logic, no DB needed) plus route-
level tests for status transitions, the signup role-lock security fix, bulk-action partial
failure, and alert dismissal authorization, using a mocked Prisma client. **See
`tests/README.md` for exactly what is and isn't covered** — it's deliberately honest about
the gaps (no real-database integration tests, not every route has a test) rather than
implying full coverage.

## Known gaps / next steps

This is a working scaffold covering all 10 goals end-to-end, but a few things are intentionally
left simple and worth hardening before calling it "done":

- **User lookup for adding project members** currently expects a raw user ID (no search-by-email
  UI yet) — noted in the project detail page.
- **Concurrent bulk-action writes** are not wrapped in a single DB transaction across tasks (each
  task's update is independent by design, per the brief's per-task success/failure requirement),
  but within the audit-log-plus-membership-removal flow, consider whether stronger atomicity is
  needed at higher scale.
- **No automated tests yet** — if you have time left in your budget, prioritize tests for
  `src/lib/taskStateMachine.js` (pure function, easy to test exhaustively) and the bulk-action route.
- **No rate limiting / brute-force protection** on login — acceptable for a take-home, call it out
  in `docs/decisions.md` as a deliberate scope cut if asked.

Treat this list as a starting point for your own `docs/plan.md` "what I'd do with another 12
hours" section — don't just copy it in, decide for yourself what you'd actually prioritize.
