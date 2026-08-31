# Tests

Run with:
```bash
npm install
npm test          # runs once
npm run test:watch  # re-runs on file changes
```

No database or `.env` needed for these tests — every test either exercises pure logic
directly, or mocks `@/lib/prisma` so route handlers run against fake data instead of a real
database. That's a deliberate trade-off (see "What this does NOT cover" below).

## What's covered, and why these files specifically

**`taskStateMachine.test.js` (26 tests)** — the pure transition/blocking/cycle-detection logic
in `src/lib/taskStateMachine.js`. This is the highest-value file to test exhaustively: it has
zero dependencies, encodes almost all of goal 4's specific rules, and both the API route and
the frontend rely on it agreeing with itself. Covers every legal transition, every illegal
one (with the reason message asserted, not just the reject), the blocked/unblock round-trip,
the incomplete-blocker-blocks-Done rule, and cycle detection including a diamond-dependency
case that should NOT be flagged as a cycle.

**`status-route.test.js` (11 tests)** — `PATCH /api/tasks/:id/status`, the actual enforcement
point for goal 4. Tests auth (401), not-found (404), non-member (403), every legal/illegal
transition end-to-end through the real handler, that illegal transitions never reach
`prisma.task.update`, and — importantly — the manager-portfolio-access fix (a manager with no
`ProjectMember` row for a project must still be allowed through).

**`signup-route.test.js` (4 tests)** — specifically covers the security fix where signup used
to accept a client-supplied `role` field. The core assertion: even if a request body says
`role: "MANAGER"`, the user gets created as `MEMBER` regardless. Also covers duplicate-email
and basic validation edge cases.

**`bulk-route.test.js` (6 tests)** — goal 7's specific requirement that one bad task in a
bulk request doesn't fail the others. Tests a mixed batch (one legal move, one blocked-by-
incomplete-dependency) and asserts both the per-task result shape and that the successful
task's write actually happened despite the other one failing. Also covers a nonexistent task
id and a task in a project the requester can't access — both should show up as a failed
result for that one task, not a 403/500 for the whole request.

**`alerts-dismiss-route.test.js` (3 tests)** — goal 10's "may only dismiss an alert for a task
they are assigned to" rule, including the case where the requester is a manager but isn't
personally assigned — role doesn't override the assignment check.

## What this does NOT cover — be honest about this in your submission

This is not full API test coverage, and you should say so plainly rather than imply
otherwise:

- **No database is actually exercised.** Every route test mocks `@/lib/prisma`. That proves
  the route's *logic* is correct given certain data, but not that your actual Prisma queries
  (the `where` clauses, the `include`s, cascading deletes) work against real Postgres. A
  Prisma query with a typo'd field name would still pass these tests.
- **Not every route has a test.** Projects CRUD, task CRUD, assignees, comments, dashboard
  aggregates, CSV export, saved filters, activity feed, and the cycle-detection wiring in the
  task-update route are untested. The five files here were chosen because they cover the
  requirements most likely to be discussed in the interview (server-side enforcement, the
  state machine, bulk partial-failure, and the two security fixes made during review) — not
  because the rest doesn't matter.
- **No end-to-end/browser tests.** Nothing here clicks a button or renders a page.

If you have time left in your budget, the highest-value next additions would be: an
integration test that runs migrations against a real (disposable) test database and exercises
a few full request/response cycles without mocking, and unit tests for the CSV export and
dashboard aggregate queries, which have no coverage at all right now.
