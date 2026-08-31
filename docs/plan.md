# Plan

## How the work was broken into sessions

The brief suggested ~12 hours across a week (~2 hours per day). I planned 6 sessions with a "demoable and committable" outcome at the end of each, so there was always something working to show — never a half-built state.

| Session | Focus | Goals covered |
|---|---|---|
| 1 | Repo scaffold, Prisma schema, auth (login/signup/JWT/cookie), role middleware | Goal 1 |
| 2 | Projects CRUD + archive, task CRUD, project membership, basic UI pages | Goals 2, 3 |
| 3 | Task state machine, lifecycle enforcement, assignment, unassign-on-remove | Goals 4, 5 |
| 4 | Server-side search/filter/sort/pagination, bulk actions (status/assignee/dueDate), CSV export | Goals 6, 7 |
| 5 | Dashboard aggregates, immutable audit trail, timeline UI, comments | Goals 8, 9 |
| 6 | Overdue alerts, dismiss logic, alert reappear, nav badge, seed data, tests, polish | Goal 10 + quality |

---

## What order I built in and why

**Auth first (Session 1)** — everything downstream depends on knowing who is asking and what role they hold. Building auth first means you never have to retrofit security onto routes that started unauthenticated.

**Schema early, migrate once** — the Prisma schema was written in full before Session 2 started. Having the complete data model early meant no mid-project migrations that would break in-progress work. The one exception was adding `dueDateUpdatedAt` to `Task` in Session 6 when the alert-reappear requirement was fully understood.

**State machine before UI (Session 3 before frontend work)** — `taskStateMachine.js` was written as pure functions first and tested in isolation before any HTTP route was wired up. This meant the transition rules were verifiable without running a browser or a database, which caught an edge case (DONE → IN_REVIEW reopening was not in the initial implementation) before it ever reached a route.

**Server-side query before bulk (Session 4)** — the filtering/pagination infrastructure was needed to make the bulk response meaningful (you need to see the result in context). Building `GET /api/tasks` fully before `POST /api/tasks/bulk` also reused the same `where` clause builder for the CSV export.

**Audit trail before dashboard (Session 5)** — `writeTaskEvent` was extracted as a shared helper before Dashboard aggregates, because the completions-by-week chart depends on `TaskEvent` rows being written correctly by all earlier routes. Getting the write path right first meant the dashboard queries had real data to aggregate.

---

## What I estimated vs. what it actually took

| Session | Estimated | Actual | Difference |
|---|---|---|---|
| 1 – Auth | 2h | ~2h | On target |
| 2 – Projects + Tasks | 2h | ~2.5h | +30min on task-blocker join table design |
| 3 – State machine + assignment | 2h | ~1.5h | Faster — pure function approach made testing quick |
| 4 – Search/filter/bulk/CSV | 2h | ~2.5h | +30min on pagination race condition (stale request guard) |
| 5 – Dashboard + audit | 2h | ~2h | On target |
| 6 – Alerts + polish + tests + seed | 2h | ~3h | +1h writing 49 tests from scratch; alert reappear logic took iteration |

**Total: ~14h** against the 12h budget. The overrun was entirely in testing and polish — the core feature code landed within estimate.

---

## What was cut when time ran short

Nothing from the 10 required goals was cut — all are fully implemented. The time pressure showed in the stretch goals:

- **Not built:** time tracking, @-mentions in comments, email digest, per-project custom fields, keyboard navigation
- **Partially built:** cycle detection is fully implemented (DFS across the whole blocking graph, not just a direct pair); the drag-and-drop board view is present but basic — drag works, but there is no visual column collapse or swimlane grouping
- **Built in full:** saved filter views, cross-project activity feed (both stretch)

The cut decision was explicit: finish all 10 required goals solidly before touching any stretch. "Doing 8 goals well beats doing 10 goals badly" — following the brief's own advice.
