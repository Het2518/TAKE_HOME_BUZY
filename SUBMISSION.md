# Submission

## Links

- **GitHub repository:** https://github.com/Het2518/TAKE_HOME_BUZY
- **Live application:** https://task-home-one.vercel.app

## Notes for the reviewer

The application is deployed on Vercel with a Supabase PostgreSQL database. Both are on free tiers — Vercel serverless functions cold-start in ~200–400ms after a period of idle, and the first request after a long gap may feel slightly slow. Subsequent requests within the same session are fast.

The seed data is designed to make every feature immediately visible without setup:
- **Two projects** (ACME Corp and Port Logistics) with different member compositions
- **32 tasks** spread across all 5 statuses (BACKLOG, IN_PROGRESS, IN_REVIEW, DONE, BLOCKED)
- **Several overdue tasks** (past due dates) — log in as any assigned member to see the alert badge in the nav
- **One blocking relationship** — a BLOCKED task with an incomplete blocker, so the block/unblock flow can be demonstrated without creating anything
- **Comments** already posted to several task timelines

To restore demo data at any time: `npx prisma db seed`.

## Demo credentials

All accounts use the password `Password123!`

| Role | Name | Email |
|------|------|-------|
| Manager | Aarav Shah | aarav@demo.com |
| Manager | Ananya Iyer | ananya@demo.com |
| Manager | Arjun Mehta | arjun@demo.com |
| Manager | Priya Nair | priya@demo.com |
| Member | Vihaan Kapoor | vihaan@demo.com |
| Member | Diya Rao | diya@demo.com |
| Member | Aditya Verma | aditya@demo.com |
| Member | Kavya Sharma | kavya@demo.com |
| Member | Rohan Gupta | rohan@demo.com |
| Member | Meera Joshi | meera@demo.com |
| Member | Ishaan Pillai | ishaan@demo.com |
| Member | Pooja Desai | pooja@demo.com |
| Member | Karan Malhotra | karan@demo.com |
| Member | Nisha Bhat | nisha@demo.com |
| Member | Rahul Sinha | rahul@demo.com |
| Member | Sanya Pandey | sanya@demo.com |

You can also sign up as a new user at `/signup` — new accounts are always created as Member role.

**Suggested walkthrough:**
1. Log in as `aarav@demo.com` (Manager) — see the full portfolio on the dashboard, manage projects and members
2. Log in as `vihaan@demo.com` (Member) — see only projects you belong to; check the Alerts tab for overdue tasks assigned to you
3. On any task: change its status, add a comment, and watch the Timeline panel update immutably
4. On the All Tasks page: filter by project + status, select multiple tasks, try bulk "Set due date"

## Stack

| Layer | Technology | Version | Why this choice |
|-------|-----------|---------|-----------------|
| Frontend framework | Next.js (App Router) | 14 | Single codebase for UI and API; one deployment; no CORS configuration needed |
| UI | React (client components) | 18 | Paired with Next.js; familiar; `useState`/`useEffect` sufficient for this scope |
| Styling | Vanilla CSS custom properties | — | Full control; dark/light theme via `data-theme` attribute; no framework-specific class names |
| API layer | Next.js Route Handlers (Node.js) | 14 | Same process as the frontend; structurally identical to Express handlers |
| ORM | Prisma | 5 | Type-safe query builder; schema-as-code is the `docs/schema.md` source of truth; migration tracking |
| Database | PostgreSQL (Supabase managed) | 15 | Relational constraints enforce real invariants; transactions for atomic operations; `ILIKE` for case-insensitive search |
| Auth | JWT (`jsonwebtoken`) + bcrypt | — | httpOnly cookie prevents XSS token theft; role in JWT payload avoids DB lookup on every request |
| Validation | Zod | 3 | Runtime type safety on every API input; `.safeParse()` produces readable English error messages |
| Testing | Vitest | 1 | Zero-config with Node.js; `vi.mock` for Prisma mocking; fast (49 tests in < 750ms) |
| Hosting (app) | Vercel | — | Native Next.js host; zero-config deployment from GitHub |
| Hosting (DB) | Supabase | — | Managed Postgres; free tier; direct connection string for Prisma |

## Goal checklist

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | **Accounts and roles** — MANAGER and MEMBER, enforced server-side | ✅ Done | `requireRole` and `requireProjectAccess` in `src/lib/permissions.js` enforce access on every route. Self-service signup creates MEMBER only (no `role` field accepted by `signupSchema`). Login/signup/logout routes. httpOnly JWT cookie. |
| 2 | **Projects** — key, name, description, owner, archive/restore | ✅ Done | Full CRUD on `/api/projects`. Archive is a soft flag — tasks and history preserved. Member add/remove with cascade unassign in a single Prisma transaction. |
| 3 | **Tasks** — create, edit, delete, same-project blockers | ✅ Done | Task detail page has an inline edit form (title, description, priority, dueDate). PATCH `/api/tasks/:id` logs each changed field individually to the timeline. DELETE is MANAGER-only. Cross-project blockers rejected with a 422. Cycle detection (DFS) prevents circular blocking. |
| 4 | **Task lifecycle** — state machine, BLOCKED/unblock, DONE blocked by incomplete blockers | ✅ Done | `src/lib/taskStateMachine.js` is the single source of truth — used by the API route (enforcement) and by the React component (rendering only legal buttons). BLOCKED stores `blockedFromStatus`; UNBLOCK restores it. DONE rejected if any blocker is not DONE. 26 exhaustive tests. |
| 5 | **Assignment** — members only, cascade unassign on project removal, My Tasks | ✅ Done | `TaskAssignee` join table. Assignment API checks that the user is a project member first. Removing a member calls `prisma.$transaction` to delete all their assignments in that project and write `UNASSIGNED` events. My Tasks page uses server-side pagination. |
| 6 | **Finding things** — search, filter, sort, pagination | ✅ Done | Server-side in `GET /api/tasks`. Search uses Postgres `ILIKE` on title + description. Filters: project, status, assignee, priority, overdue flag. Sort: dueDate, priority, updatedAt (asc/desc). Page-based pagination with total count. Debounced search input (350ms) with stale-request guard. Saved filter views (stretch). |
| 7 | **Bulk actions + CSV export** — status, assignee, due date; per-task result | ✅ Done | `POST /api/tasks/bulk` accepts `action: "STATUS" \| "ASSIGNEE" \| "DUE_DATE"`. Returns `[{ taskId, success, message }]` — one entry per task; one failure does not stop others. `GET /api/tasks/export` returns a CSV of the current filtered view. Bulk toolbar in the UI exposes all three action types. |
| 8 | **Dashboard** — headline numbers, charts, role-scoped | ✅ Done | 7 Prisma queries run in `Promise.all`: open count, overdue count, due-this-week count, completed-this-week count, `groupBy` status, `groupBy` assignee, DONE tasks for 8-week completion chart. Manager sees full portfolio; member sees only their projects. All numbers computed server-side — no client-side aggregation. |
| 9 | **Immutable history** — audit trail, timeline, comments | ✅ Done | `TaskEvent` table: insert-only via `writeTaskEvent` in `src/lib/auditLog.js`. Events: CREATED, FIELD_CHANGE (per field), STATUS_CHANGE, ASSIGNED, UNASSIGNED, COMMENT. There is no UPDATE or DELETE endpoint for `TaskEvent` anywhere in the codebase. Timeline displayed on task detail page in chronological order. Comments posted from the same panel. |
| 10 | **Overdue alerts** — dismiss, reappear on due-date change | ✅ Done | `GET /api/alerts` returns overdue (dueDate < now, status ≠ DONE) tasks where I am assigned. `POST /api/alerts/:id/dismiss` creates/updates an `AlertDismissal` row — only the assigned user can dismiss (403 otherwise). Alert reappears when `task.dueDateUpdatedAt > dismissal.dismissedAt`. Nav badge shows count, updated on every dashboard layout mount. |

**Stretch goals completed:**
| Stretch | Where |
|---|---|
| Cycle detection (full blocking graph, not just direct pairs) | `wouldCreateCycle` in `src/lib/taskStateMachine.js` — DFS on adjacency list |
| Drag-and-drop Kanban board | `src/app/(dashboard)/board/page.js` |
| Saved filter views | `SavedFilter` model; `GET/POST /api/saved-filters`; delete per filter |
| Cross-project activity feed | `GET /api/activity`; paginated; role-scoped |
| Time tracking | `TimeEntry` model, `<TimeTracker />`, `/api/tasks/:id/time` |
| @-mentions in comments | `MentionInput`, `highlightMentions`, parses raw text |
| Email digest | `/api/digest`, Nodemailer SMTP transport, preview page |
| Per-project custom fields | `CustomFieldDefinition`/`Value`, `<CustomFieldsPanel />` |
| Keyboard navigation | `useKeyboardNav` global hook (`/`, `?`, `g+letter`) |

## How much time did you actually spend?

~14 hours across 7 days.

| Session | Date | Focus | Time |
|---|---|---|---|
| 1 | Day 1 | Schema + auth | ~2h |
| 2 | Day 2 | Projects + Tasks CRUD + basic UI | ~2.5h |
| 3 | Day 3 | State machine + lifecycle + assignment | ~1.5h |
| 4 | Day 4–5 | Search/filter/bulk/CSV + debounce/race fix | ~2.5h |
| 5 | Day 5–6 | Dashboard + audit trail + timeline | ~2h |
| 6 | Day 7 | Alerts + tests + seed + docs | ~3h |

The 2-hour overrun (12h budgeted, ~14h actual) came from writing 49 tests from scratch (~1h) and the stale-request guard on the search input (~30min). The core feature code landed within the session estimates.

## What would you do next, with another 12 hours?

**1. End-to-end verification against the live database (first priority, ~2h)**
Everything in this submission is verified by unit/mocked tests and careful reading. It has not been exercised against a real Postgres instance with real session cookies end-to-end. The first 2 hours would be a full manual walkthrough of every user flow on the deployed app, logging every 500 and every piece of wrong data as a bug to fix.

**2. Expand test coverage to all routes (~3h)**
49 tests cover 5 of ~22 route files. Projects CRUD, member management, dashboard aggregates, task CRUD (PATCH/DELETE), and the CSV export have no tests. The right approach is integration tests with a real test database (separate `TEST_DATABASE_URL`, reset with `prisma migrate reset` before each run) — these catch bugs that mocked tests cannot, like a wrong Prisma field name.

**3. Fix the dashboard completions-by-week query (~1h)**
The current implementation fetches all DONE tasks updated in the last 8 weeks and buckets them in JavaScript using `Array.filter`. This is the only place in the codebase where work that belongs in Postgres runs in Node.js. The correct implementation is:
```sql
SELECT date_trunc('week', "updatedAt") as week, COUNT(*) as count
FROM "Task"
WHERE status = 'DONE' AND "updatedAt" >= NOW() - INTERVAL '8 weeks'
GROUP BY week ORDER BY week
```
In Prisma this requires `prisma.$queryRaw` with tagged template literals — I avoided raw SQL to keep the codebase consistent, but at any real data scale this query would be the first performance issue.

**4. Real-time updates via Supabase Realtime (~3h)**
Changes made in one browser tab are not pushed to another user's tab. Supabase exposes a Postgres change-data-capture WebSocket feed that can be subscribed to from the browser. Wiring it up would make status changes and new assignments appear in other users' open tabs without a refresh.

## What are you least happy with in this codebase, and why?

**The dashboard completions-by-week chart**, without question. It is the only place in the entire codebase where data aggregation happens in JavaScript rather than in the database. The reason it is there: `date_trunc` is a Postgres-specific function and Prisma's query builder does not support it without dropping to `prisma.$queryRaw`. I chose to avoid raw SQL throughout the codebase for consistency — every other query is Prisma ORM. But the consequence is a `findMany` that returns potentially thousands of rows just to count them in a JavaScript `filter`. I am not satisfied with this compromise and said so in the comment in `src/app/api/dashboard/route.js`.

The second thing is **test coverage breadth**. The 49 tests that exist are genuinely rigorous for what they cover — 26 of them exhaustively test the state machine against every status/blocker combination. But 17 of 22 route files have no tests at all. A reviewer asking "does your application work end-to-end" cannot get a complete answer from these tests. The honest characterisation (documented in `tests/README.md`) is: these tests prove that specific logic is correct given certain inputs — they do not prove the full request pipeline works against a real database. If I had 3 more hours, expanding test coverage to all routes with a real test database would be the spend — not adding features.
