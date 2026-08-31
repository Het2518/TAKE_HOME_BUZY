# Submission

## Links

- **GitHub repository:** <add your public GitHub repo URL here before submitting>
- **Live application:** <add your Vercel deployment URL here before submitting>

## Notes for the reviewer

The application is deployed on Vercel (Next.js) with a Supabase PostgreSQL database. Vercel's serverless functions cold-start in under 1 second on the free tier — there should be no noticeable delay on the first request.

Demo accounts are seeded with realistic data across two projects (ACME Corp and Port Logistics) — 30+ tasks spread across all statuses, with blocking relationships, assignments, comments, and overdue items already present so all features are visible without setup.

The `prisma/seed.js` script can be re-run at any time to restore the demo data: `npx prisma db seed`.

## Demo credentials

| Role | Email | Password |
|------|-------|----------|
| Manager | aarav@demo.com | Password123! |
| Manager | ananya@demo.com | Password123! |
| Manager | arjun@demo.com | Password123! |
| Member | vihaan@demo.com | Password123! |
| Member | diya@demo.com | Password123! |
| Member | aditya@demo.com | Password123! |
| Member | kavya@demo.com | Password123! |
| Member | rohan@demo.com | Password123! |

All seeded users share the same password. Sign up as a new user at `/signup` to get a fresh Member account.

## Stack

| Layer | What I used | Why |
|-------|-------------|-----|
| Frontend | Next.js 14, React (client components), Vanilla CSS | App Router co-locates pages and API routes in one codebase; no separate Vite/Express setup needed |
| Backend | Next.js API Route Handlers (Node.js) | Same process as the frontend — no CORS, one deployment, one set of env vars |
| ORM / DB access | Prisma 5 | Type-safe query builder, migration tracking, schema as source of truth for `docs/schema.md` |
| Database | PostgreSQL (Supabase managed) | Relational constraints, real transactions, and meaningful answers to "what's in the DB vs. app code" |
| Auth | JWT (`jsonwebtoken`) + bcrypt, httpOnly cookie | XSS-safe (no localStorage), cookie attached automatically to same-origin requests |
| Hosting | Vercel (app) + Supabase (DB) | Both have generous free tiers; Vercel is the canonical Next.js host |
| Testing | Vitest | Zero-config with Node.js, fast, good mocking API for Prisma |

## Goal checklist

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Accounts & roles (MANAGER / MEMBER) | Done | JWT auth, bcrypt, role enforced server-side on every protected route. Self-service signup always creates MEMBER. |
| 2 | Projects (key, name, desc, owner, archive) | Done | Full CRUD, archive/restore toggle, members add/remove with cascade unassign. |
| 3 | Tasks (CRUD, priority, due date, blockers) | Done | Create, edit (title/description/priority/dueDate via inline edit form), delete (manager only), same-project blocker validation. |
| 4 | Task lifecycle with enforced rules | Done | State machine in `src/lib/taskStateMachine.js`, used by both API and UI. All specific rules (BLOCKED from IN_PROGRESS/IN_REVIEW, unblock returns to prior status, DONE blocked by incomplete blockers) implemented and tested. |
| 5 | Assignment | Done | Many-to-many TaskAssignee, membership-restricted, cascade unassign on member removal, "My Tasks" page. |
| 6 | Search / filter / sort / pagination | Done | Server-side across title+description, filters for project, status, assignee, priority, overdue. Sort by dueDate/priority/updatedAt. Page-based pagination with total count. Saved filter views (stretch). |
| 7 | Bulk actions + CSV export | Done | Bulk status change, bulk assignee, bulk due date — per-task success/failure response. CSV export of current filtered view. |
| 8 | Dashboard | Done | Headline numbers (open, overdue, due this week, completed this week). Tasks by status chart, tasks by assignee chart, completions by week (8 weeks). Manager sees full portfolio; members see only their projects. |
| 9 | Immutable history / audit trail | Done | `TaskEvent` table with insert-only write path (`writeTaskEvent` helper). Events for CREATED, FIELD_CHANGE (every scalar field), ASSIGNED, UNASSIGNED, STATUS_CHANGE, COMMENT. Timeline visible on task detail page with comment input. |
| 10 | Overdue alerts | Done | `GET /api/alerts` returns overdue non-Done tasks the user is assigned to. Nav badge shows count. Dismiss (assigned users only). Alert reappears if `dueDateUpdatedAt > dismissedAt`. |

**Stretch goals completed:**
- Cycle detection across full blocking graph (DFS in `taskStateMachine.js`)
- Drag-and-drop Kanban board view (`/board`)
- Saved filter views (save, apply, delete named filter sets)
- Cross-project activity feed (`/activity`)

## How much time did you actually spend?

Approximately 14 hours across 6 sessions over 7 days, spread as follows:

| Session | Work | Time |
|---|---|---|
| 1 | Scaffold, Prisma schema, auth | ~2h |
| 2 | Projects + Tasks CRUD, membership, basic UI | ~2.5h |
| 3 | State machine, lifecycle, assignment | ~1.5h |
| 4 | Search/filter/bulk/CSV + pagination race condition | ~2.5h |
| 5 | Dashboard aggregates, audit trail, timeline UI | ~2h |
| 6 | Alerts, tests, seed data, polish, docs | ~3h |

## What would you do next, with another 12 hours?

1. **Deploy and test against the live database** — the code is verified by isolated unit tests and careful reading, but has not been exercised against a real Postgres instance with live session cookies end-to-end. First priority would be a full run-through of every user flow on the deployed app.

2. **Expand test coverage** — currently 49 tests cover 5 of ~20 route handlers. The projects CRUD, member management, dashboard aggregates, and CSV export routes have no tests. Integration tests with a real test DB (using Prisma's test client against a separate `DATABASE_URL`) would catch the class of bug (e.g. wrong Prisma field name) that mocked tests can't.

3. **Dashboard 100x fix** — the completions-by-week chart currently fetches all matching rows and buckets in JavaScript. At scale, this should be a `GROUP BY date_trunc('week', ...)` query pushed to Postgres.

4. **Email notifications** — the alert system tells you about overdue tasks on-screen. An email digest (daily or on-assign) would require integrating a transactional email provider (Resend is free tier) and a scheduled function.

5. **Proper loading skeletons** — the current loading state is an opacity fade. Purpose-built skeleton components would feel more polished.

## What are you least happy with in this codebase, and why?

The **dashboard completion chart** (`GET /api/dashboard`, the `weeklyData` section). It fetches every DONE task updated in the last 8 weeks and counts them in JavaScript using `reduce`. This is the only place in the codebase where work that belongs in the database is happening in application code. At any real scale it would be the first thing to blow up. The correct implementation is a single `GROUP BY date_trunc('week', "updatedAt") WHERE status = 'DONE'` query, but getting that across Prisma's query builder requires raw SQL (`prisma.$queryRaw`), which I avoided to keep the codebase consistent. It's a deliberate compromise I'm not satisfied with.

The second thing is **test coverage breadth**. The 49 tests are rigorous for what they cover, but the coverage surface is narrow — only 5 of ~20 route files have any tests at all. A reviewer who asks "does this work end-to-end" cannot be fully answered by these tests alone. If I had another 3 hours, test coverage would be the spend.
