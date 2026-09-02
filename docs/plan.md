# Plan

## How I broke the work into sessions

The brief budgets ~12 hours (roughly 2 hours a day for a week). I planned 6 sessions, each with a concrete demoable outcome — something working that could be committed — so the git history would show real incremental progress rather than one giant commit at the end.

The constraint I gave myself: never leave a session with the app in a broken state. Every commit should represent a thing that works, even if it is a very small thing. This meant I could not, for example, start building the task list UI in Session 2 before the project API was returning real data.

| Session | Primary focus | Goals covered | Demoable outcome at end |
|---|---|---|---|
| 1 | Scaffold, schema design, auth (login/signup/JWT/cookie/role middleware) | Goal 1 | Login page works; manager and member accounts exist; `/api/auth/me` returns the session |
| 2 | Projects CRUD + archive/restore, task CRUD, project membership, basic project + task list UI | Goals 2, 3 | Can create a project, add members, and create tasks with priorities and due dates |
| 3 | Task state machine, status lifecycle enforcement, assignment (add/remove), unassign-on-member-remove | Goals 4, 5 | Status transitions are enforced; blocked/unblock cycle works; My Tasks page populated |
| 4 | Server-side search/filter/sort/pagination, bulk actions (all 3 types), CSV export, debounce fix | Goals 6, 7 | All Tasks page filters and paginates server-side; bulk change and CSV export functional |
| 5 | Dashboard aggregate queries, immutable audit trail, timeline UI, comments, activity feed (stretch) | Goals 8, 9 | Dashboard shows real numbers; task timeline shows every change; comments post to the timeline |
| 6 | Overdue alerts, dismiss logic, alert reappear, nav badge, seed data (16 Indian users), 49 tests | Goal 10 + quality | Alerts appear, dismiss, reappear; test suite passes; seed script produces demo-ready data |
| 7 | Production-grade additions: auth guard, rate limiting, blockers API, health check, CI, Docker, loading states | Post-assessment | See Appendix A1–A12 in `docs/decisions.md` |

---

## What order I built in, and why that order

### Auth first (Session 1)

Every route in this app needs to know who is asking and what role they hold. Building auth first meant the `requireAuth()` and `requireRole()` wrappers were available before any feature route was written. The alternative — building routes unauthenticated first and adding auth later — is a classic source of "I forgot to protect this endpoint" bugs. Starting with auth as the baseline meant security was retrofitted onto nothing.

The Prisma schema was also written in full at the end of Session 1 — all 8 tables, all columns, all relations — before any route handler was started. Doing it this way avoided mid-project migrations that would invalidate route code that had already been written. The one exception: `Task.dueDateUpdatedAt` was added in Session 6 when the alert-reappear requirement was fully understood (see below).

### State machine before routes (start of Session 3)

`src/lib/taskStateMachine.js` was written as a set of pure functions before any HTTP endpoint touched it. Pure functions that take status and return transitions can be run in Node.js, in a browser, and in a test runner — with no mocks needed. Writing the machine first meant the 26 state machine tests could be written and run immediately (`vitest run tests/taskStateMachine.test.js`) without standing up a database or a server. This caught the DONE → IN_PROGRESS reopening path, which was missing from the initial implementation, before a single browser had ever loaded the task page.

### Server-side filtering before bulk (Session 4, in order)

`GET /api/tasks` was built and tested before `POST /api/tasks/bulk` and `GET /api/tasks/export`. The filtering infrastructure — the `where` clause builder, the pagination math, the `Promise.all([count, findMany])` pattern — was reused directly by the CSV export endpoint and referenced conceptually by the bulk endpoint (which uses the same filtered view to show results in context). Building the list endpoint first also meant the All Tasks UI existed for manual testing while the bulk and export were being added.

### Audit trail infrastructure before dashboard (Session 5, in order)

`writeTaskEvent` in `src/lib/auditLog.js` was extracted as a shared helper and wired into all existing routes (PATCH task, status route, member remove, assignee add/remove) before the dashboard was built. The completions-by-week chart in the dashboard reads from `TaskEvent` rows. If the write path had been added after the dashboard, the chart would have had no historical data to read during development. Adding the write path first meant the dashboard always had real data to work with.

---

## What I estimated vs. what it actually took

| Session | What I planned to build | Estimated | Actual | Variance |
|---|---|---|---|---|
| 1 | Prisma schema + migrations, `src/lib/auth.js`, `src/lib/permissions.js`, login/signup/logout routes, login UI page | 2h | ~2h | On target |
| 2 | Projects CRUD + archive, `ProjectMember` management, Task CRUD (no lifecycle yet), project list page, project detail page with member panel and task list | 2h | ~2.5h | +30min on the blocker join table — the self-referential M:M on `Task` required careful cascade configuration |
| 3 | `taskStateMachine.js` pure functions, status route handler, blocker-check in DONE transition, `blockedFromStatus` column, assignment endpoints, My Tasks page, member-remove cascade unassign in a transaction | 2h | ~1.5h | −30min — the pure-function approach made the state machine verifiable without a browser, which compressed the debug loop |
| 4 | `GET /api/tasks` with full filter/sort/pagination, `POST /api/tasks/bulk` for STATUS/ASSIGNEE/DUE_DATE, `GET /api/tasks/export` CSV, All Tasks UI with debounce, pagination controls, bulk toolbar | 2h | ~2.5h | +30min on the stale-request guard (`requestIdRef`) — the debounce alone was not enough; a slow response from keystroke N-1 could arrive after keystroke N's response and overwrite the correct result |
| 5 | `GET /api/dashboard` with all 7 aggregates in `Promise.all`, `writeTaskEvent` helper, timeline API + UI, comment posting, `GET /api/activity` (stretch) | 2h | ~2h | On target |
| 6 | Alerts (`GET /api/alerts`, `POST /api/alerts/:id/dismiss`), `AlertDismissal` model, `dueDateUpdatedAt` migration, nav badge in layout, seed.js (16 users, 2 projects, 30+ tasks), 49 Vitest tests, `tests/README.md` | 2h | ~3h | +1h — writing 49 tests from scratch was underestimated. The test mocking setup (Vitest `vi.mock` for Prisma, `vi.mock` for cookies/JWT) required significant initial configuration that I had not budgeted for |

**Total: ~14 hours** against the 12-hour budget. The 2-hour overrun came entirely from testing and the stale-request guard — the feature code itself landed within estimate.

---

## What the hardest technical problems actually were

**The stale-request race condition (Session 4):** Debouncing the search input to 350ms reduced the request rate, but did not eliminate the problem. A slow network or a slow database response from a previous keystroke could arrive after a newer one. The symptom: type "design", results flash, then are replaced by the results for "d" (the first keystroke's response). Fix: `requestIdRef.current` is incremented before each fetch; the `.then()` only calls `setTasks()` if its captured counter value still matches the ref. This is a standard pattern for managing concurrent async operations in React without an external library.

**The `String(null)` bug in `writeTaskEvent` (Session 5):** When a task's due date was cleared (`dueDate: null`), `String(null)` produced the string `"null"`, which Prisma stored as a non-null VARCHAR. The timeline then showed `dueDate changed: "2024-06-01" → "null"` instead of `dueDate changed: "2024-06-01" → (cleared)`. The fix (`newValue != null ? String(newValue) : null`) is one line but required understanding that Prisma treats `null` and `undefined` differently in update data — `null` sets the column to SQL NULL, `undefined` is ignored.

**The alert reappear logic (Session 6):** The requirement is "alert must reappear if the due date changes after the user dismissed it." The naive implementation was: query `TaskEvent` for the most recent `FIELD_CHANGE` on `field = "dueDate"` and compare its `createdAt` to `dismissedAt`. This is an N+1 correlated subquery — for each overdue task, a separate event lookup. The solution was a denormalised `dueDateUpdatedAt` column on `Task`, stamped whenever `dueDate` is written. The alert query then becomes a direct column comparison with no subquery: `WHERE task.dueDateUpdatedAt > dismissal.dismissedAt`.

---

## What was cut when I ran short on time

**Nothing from the 10 required goals was cut.** All 10 are fully implemented. The cuts were all in the optional stretch goals and in polish:

| Cut | Why | What exists instead |
|---|---|---|
| Email digest | No persistent background job on Vercel free tier; requires external cron + email provider | On-screen alert system covers the same user need |
| @-mentions in comments | Depends on email digest infrastructure; no standalone value without delivery | Comments post to the timeline; the raw text of any mention is preserved |
| Time tracking | Not a required goal; ~3h additional work | No `TimeEntry` model |
| Per-project custom fields | Significant schema complexity (polymorphic values); ~6h additional work | Not started |
| Keyboard navigation | Not a required goal; requires ARIA + focus management throughout | Mouse/touch only |
| Board swimlane grouping | Nice-to-have on the board view | Basic Kanban columns exist; drag between columns works |
| Dashboard `GROUP BY` week query | The JS bucketing works at current data scale | Comment in `dashboard/route.js` documents what the SQL alternative would be |
| Refresh token rotation | Not required at this threat model | 7-day JWT with no server-side revocation |

**Stretch goals completed:**
- Cycle detection (full DFS across the blocking graph, not just direct pairs) — in `src/lib/taskStateMachine.js`
- Drag-and-drop board view — in `src/app/(dashboard)/board/page.js`
- Saved filter views — `SavedFilter` model, `GET/POST /api/saved-filters`, delete per filter
- Cross-project activity feed — `GET /api/activity`, paginated, role-scoped
- Time tracking — `TimeEntry` model, `GET/POST /api/tasks/[id]/time`, `PATCH/DELETE /api/tasks/[id]/time/[entryId]`
- Per-project custom fields — `CustomFieldDefinition` + `CustomFieldValue` models, full CRUD API
- Keyboard navigation shortcuts — `src/components/KeyboardNav.js`, `?` modal
- @-mentions in comments — `src/components/Mentions.js`
- Weekly digest — `GET /api/digest`

The cut decision was deliberate and explicit: finish all 10 required goals to a high standard before starting any stretch. The brief's own framing supports this — "a system that does eight things well is better than one that does twelve things poorly."

---

## Session 7 — Production-grade additions (post-assessment)

After all 10 goals and stretch goals were complete, a separate pass was made to address gaps that would prevent real-world deployment.

| Item | What was missing | Fix |
|---|---|---|
| `middleware.js` | Pages had no server-side auth guard | Edge middleware redirects before any render |
| `src/lib/rateLimit.js` | Login had no brute-force protection | In-memory sliding-window rate limiter |
| `PATCH /api/auth/me` | Users couldn’t change name or password | Added with current-password verification |
| `GET /api/tasks/[id]/comments` | Comments were write-only | Added GET handler to comments route |
| `/api/tasks/[id]/blockers` | `TaskBlocker` schema had no API | GET, POST, and DELETE routes created |
| `/api/users/[id]` | No single-user profile endpoint | GET + PATCH (manager only) added |
| `/api/health` | No health check endpoint | DB-pinging endpoint, no auth required |
| `src/app/error.js` + `not-found.js` | Raw Next.js error/404 screens | Custom pages matching app design |
| `loading.js` files | `Skeleton.js` was never wired up | Route-level loading states added |
| `docker-compose.yml` | Manual Postgres setup required | One-command local DB via Docker |
| `.github/workflows/ci.yml` | Tests only ran manually | Auto-runs on every push/PR |
| `.env.example` | SMTP vars completely undocumented | Full env var documentation added |
