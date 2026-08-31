# AI Prompts

I used an AI assistant throughout this project as a pair-programming and thinking tool — for scaffolding, architectural decisions, debugging, and code review. Below are all significant prompts in the order they were sent, grouped by what I was trying to achieve. Every entry includes what I asked, what I got back, and — critically — what I had to correct or push back on.

The brief asks for at least one prompt that produced something wrong. There are three here (marked clearly), because that is the honest number.

---

## 1 — Reading the brief and making a plan

### Prompt
> "Read through the whole brief in my zip — it's a solid, well-specified take-home (project/task tracker with roles, workflow rules, dashboards, audit history, alerts). What do I do, how do I do it, what's the plan for making this?"

### What I got
A full 6-session build plan ordered by dependency: auth before projects before tasks before workflow before dashboard before alerts. The AI framed the brief in a way I hadn't: the docs, the git history, and the ability to explain decisions out loud are as important as the code. It specifically warned that a single-commit repo scores zero regardless of code quality, and recommended treating it as iterative pair-programming rather than generating a finished app.

### What I corrected
Nothing on the session plan itself — the ordering was sound. I pushed back on one thing: the AI's initial instinct was to generate a large amount of code immediately. I redirected to "explain each piece as we build it so I can defend it in an interview" — that constraint shaped the whole collaboration.

---

## 2 — Stack selection

### Prompt
> "Give me the best stack but I know MERN — I'll go for whatever's best for this. How comfortable are you with SQL / an ORM? Comfortable with both."

### What I got
A specific recommendation to drop MongoDB and use PostgreSQL with Prisma, keeping Node.js and React but replacing Mongo. Three concrete reasons were given:
1. The data model (many-to-many task blocking, many-to-many assignment, append-only audit trail) is relational — Mongo handles it with application-side joins and embedded arrays that drift
2. The brief's `docs/schema.md` requirement ("justify constraints in DB vs. application code") is nearly unanswerable for a document store
3. Real transactions (needed for member removal + cascade unassign) are first-class in Postgres; in Mongo on a free-tier Atlas cluster, multi-document transactions have performance caveats

Also recommended Next.js App Router rather than separate Vite + Express — one deployment, no CORS, no proxy.

### What I corrected
No correction. I agreed with the reasoning and committed to the stack. These became Decisions 1 and 2 in `docs/decisions.md`.

---

## 3 — Auth: JWT, httpOnly cookie, role middleware

### Prompt
> "Build the auth system. Login, signup, JWT issued to an httpOnly SameSite=lax cookie (not localStorage), server-side requireAuth + requireRole middleware. Explain each piece as you build it."

### What I got
`src/lib/auth.js` — helpers for `signToken`, `verifyToken`, `hashPassword`, `verifyPassword`, `setSessionCookie`, `clearSessionCookie`. `src/lib/permissions.js` — `requireAuth`, `requireRole`, `requireProjectAccess`, `withErrorHandling`, `HttpError` class. Login and signup routes. Login page with pre-filled demo credentials.

The explanation covered: why httpOnly cookie prevents XSS token theft (`document.cookie` returns nothing for httpOnly cookies), why SameSite=lax blocks CSRF on form-submission attacks while still allowing link navigation, why the role goes in the JWT payload (avoids a DB lookup on every request to check role).

### What I corrected
The initial `requireProjectAccess` implementation only checked `project.ownerId === session.userId`. A manager who was a member of a project they didn't own would get 403 on every task in that project. The fix was to check for MANAGER role first — managers get portfolio-wide access regardless of ownership or membership — and only fall through to the `ProjectMember` lookup for members. This is now the `if (session.role === "MANAGER") return project` short-circuit in `src/lib/permissions.js` line 41.

---

## 4 — Prisma schema design

### Prompt
> "Design the full Prisma schema for all 8 tables. I need: User, Project, ProjectMember, Task, TaskBlocker (self-referential M:M for blocking), TaskAssignee, TaskEvent (immutable audit log), AlertDismissal. Include all enums, all relations, cascade behaviours, and unique constraints."

### What I got
A complete `schema.prisma` file with all 8 models, the `TaskStatus` and `Priority` enums, correct `@relation` declarations for both sides of each M:M, `onDelete: Cascade` on all FK relations that should propagate deletes (e.g. removing a task removes its events), and `@@unique([projectId, userId])` on `ProjectMember`. The `blockedFromStatus` and `dueDateUpdatedAt` nullable columns on `Task` were included with comments explaining their purpose.

### What I corrected
The initial schema put `@relation(name: "BlockingRelation")` on `TaskBlocker.task` and an unnamed `@relation` on `TaskBlocker.blockingTask`. Prisma requires both sides of a self-referential relation to carry the same named `@relation` string. The fix was to name both sides consistently: `task Task @relation("Blocked", fields: [taskId], references: [id])` and `blockingTask Task @relation("Blocking", fields: [blockingTaskId], references: [id])`, and add corresponding `blockedBy` and `blocks` fields on the `Task` model.

---

## 5 — Task state machine (pure functions)

### Prompt
> "Build the task lifecycle state machine as pure functions — no imports from Node, no database, no HTTP. Rules: BACKLOG → IN_PROGRESS → IN_REVIEW → DONE. IN_PROGRESS and IN_REVIEW can transition to BLOCKED (storing the prior status). BLOCKED can unblock back to that stored status. DONE can reopen to IN_PROGRESS. A task cannot reach DONE if any blocker is not DONE. The server rejects illegal transitions with a human-readable reason. The UI renders only legal move buttons. Both use the same function. Stretch: cycle detection on the blocking graph."

### What I got
`src/lib/taskStateMachine.js` with three exported functions:
- `getLegalTransitions(status, blockedBy, blockedFromStatus)` — returns an array of `{ label, target }` objects for the UI
- `validateTransition(currentStatus, targetStatus, hasIncompleteBlockers, blockedFromStatus)` — returns `{ ok: true }` or `{ ok: false, reason: "..." }` for the API
- `wouldCreateCycle(edges, taskId, newBlockerId)` — DFS across the full blocking adjacency list

### What I corrected
Two issues:
1. The initial `getLegalTransitions` did not include `DONE → IN_PROGRESS` (reopening). The function only listed forward transitions. Added by checking: for `DONE`, include `IN_PROGRESS` in the legal set.
2. `validateTransition` returned `{ ok: false, reason: "No transition defined" }` for the UNBLOCK pseudo-status, which was not a valid member of the `TaskStatus` enum. The status route actually sends `targetStatus: "UNBLOCK"` as a signal to return to `blockedFromStatus`, not as a literal status value. Fixed by handling `UNBLOCK` before the standard transition table check.

---

## 6 — Search, filter, and pagination — where the AI produced wrong output (first time)

### Prompt
> "Build GET /api/tasks with server-side search (title + description, case-insensitive), filter by project, status, assignee, priority, overdue flag, sort by dueDate/priority/updatedAt, and cursor-free page-based pagination returning total count and total pages. All filtering in Prisma, nothing in JavaScript."

### What I got
The API route was correct. The Prisma `where` clause was built correctly with `{ OR: [{ title: { contains: search, mode: "insensitive" } }, ...] }`. Pagination math (`skip: (page - 1) * pageSize, take: pageSize`) was correct. `Promise.all([count, findMany])` for efficiency was correct.

**The wrong part was the React component.** The `useEffect` that called the API was wired directly to the full `filters` state object, including `filters.search`. The `filters.search` was updated on every `onChange` of the search input — meaning every keystroke fired a full HTTP request. On a fast connection this just causes visible flicker. On a slow one, it hammers the database and the results lag behind typing.

### What I corrected — and how I thought about the fix

The fix required separating two concerns:
1. **The input's controlled value** — must update on every keystroke so the input feels responsive
2. **The filter state that triggers a fetch** — should only update after the user stops typing

This led to two state variables: `searchInput` (updated on `onChange`) and `filters.search` (updated via a 350ms debounce `setTimeout`). The `useEffect` that calls the API depends on `filters`, not on `searchInput`.

But the debounce alone was not sufficient. If a user types quickly, the 350ms debounce fires for each "pause" — and a slow network means response for pause-at-"d" might arrive after response for pause-at-"de". This is the race condition: a slower old response overwrites a newer correct one.

Fix: `requestIdRef` — a `useRef` containing an integer. Incremented before each fetch. The `.then()` callback captures the value at the time the fetch was made. It only calls `setTasks()` if its captured value still equals `requestIdRef.current`. If a newer fetch has been made, the captured value is stale and the response is discarded.

Final implementation is in `src/app/(dashboard)/tasks/page.js` with inline comments explaining both mechanisms.

---

## 7 — Bulk actions

### Prompt
> "Build POST /api/tasks/bulk. It takes an array of taskIds, an action type (STATUS, ASSIGNEE, DUE_DATE), and a value. For each task: check access, attempt the change, record success or failure with a reason. Return a per-task results array. One failing task should not block the others."

### What I got
`src/app/api/tasks/bulk/route.js` using a `for...of` loop over `taskIds` with a try/catch per iteration, accumulating `{ taskId, success, message }` objects. STATUS changes re-use `validateTransition` from the state machine. ASSIGNEE checks project membership before creating the `TaskAssignee` row. DUE_DATE updates the due date and `dueDateUpdatedAt` together.

### What I corrected
The initial implementation ran the per-task loops sequentially (awaiting each iteration). For STATUS changes, this is required — each status change writes an audit event, and running them in parallel could produce audit events in the wrong order. But for ASSIGNEE and DUE_DATE, the operations are independent. I left the sequential implementation intentionally after considering this: sequential is simpler to reason about, the per-task latency is small (each is one or two Prisma queries), and the payload is bounded to a user's selected rows (typically < 50). The comment in the file records this decision.

---

## 8 — Dashboard aggregates

### Prompt
> "Build GET /api/dashboard. Headline numbers: open tasks, overdue, due this week, completed this week. Charts: tasks by status (bar), tasks by assignee (bar), completions by week for last 8 weeks (line). Manager sees all projects; member sees only their projects. All numbers computed server-side."

### What I got
A route using `Promise.all` to run 7 Prisma queries simultaneously: `count` for each of the 4 headline numbers, `groupBy` for status breakdown, `groupBy` for assignee breakdown, and `findMany` for completed tasks in the last 8 weeks. Role scoping via `visibleProjectFilter` at the top. The 8-week bucketing is done in JavaScript after fetching.

### What I corrected
The initial `byAssignee` data from `groupBy` returned `userId` values, not names. The component would have had to make a second API call per assignee to resolve names. Fixed in the route: after the `groupBy`, extract all `userId` values, do one `prisma.user.findMany({ where: { id: { in: assigneeIds } } })`, build a `{ [id]: name }` map, and embed names in the response. This is the correct place to do the join — in the route, not in the browser.

---

## 9 — Overdue alerts and the reappear requirement — where the AI produced wrong output (second time)

### Prompt
> "Build the alert system. GET /api/alerts returns overdue tasks I'm assigned to. POST /api/alerts/:id/dismiss dismisses one. Only assigned users can dismiss. If the task's due date changes after I dismissed it, the alert reappears."

### What I got
The routes were structurally correct. The reappear logic was: compare `task.dueDateUpdatedAt > dismissal.dismissedAt`. But `dueDateUpdatedAt` did not exist on the `Task` model in the initial implementation. The AI suggested deriving it at query time by finding the latest `FIELD_CHANGE` event where `field = "dueDate"` — a correlated subquery inside the alert query.

### What I corrected
The correlated subquery approach is an N+1 pattern: for each overdue task, one more query into `TaskEvent` filtered by `field = "dueDate"` and `taskId = task.id`. At 50 overdue tasks, that's 50 extra queries for one page load. I added `dueDateUpdatedAt DateTime?` directly to the `Task` model and set it to `new Date()` in every route that writes `dueDate` (PATCH task, bulk DUE_DATE action). The alert query then does one join to `AlertDismissal` and a direct column comparison — no subquery needed. This is documented as Decision 10 in `docs/decisions.md`.

---

## 10 — Tests — where the AI produced wrong output (third time)

### Prompt
> "Write Vitest tests for: the state machine (every combination), the status transition route, the bulk action route, the alert dismiss route, and the signup route. Tests must run without a real database — mock Prisma with vi.mock. The test output must show 49 tests passing."

### What I got
The test files with correct structure: `vi.mock("@/lib/prisma", () => ({ prisma: { ... } }))` to replace Prisma with controlled return values, `vi.mock("@/lib/auth", ...)` to stub the cookie/JWT layer, and `vi.mock("next/headers", ...)` to stub the cookies API. The state machine tests were exhaustive — every status, with and without incomplete blockers.

**The wrong part:** The mock path for `getSessionFromCookies` in `tests/signup-route.test.js` was `"../lib/auth"` — a relative path from the test file. Vitest resolves `vi.mock` paths relative to the test file; the actual module path is `"../../src/lib/auth"` (because `tests/` is at project root, not inside `src/`). The mock silently did nothing (the real function ran), so `requireAuth()` was not returning the mocked session and the tests that expected 401 were passing for the wrong reason.

### What I corrected
Changed the mock path to `"../../src/lib/auth"`. Also discovered that two tests were passing vacuously — they were asserting on status code 401 but the route was returning 401 for a different reason (missing body fields) not because auth was blocked. Fixed by adding a test that passes a valid body but no session cookie, and asserting the 401 response body contains `"Not authenticated"`.

---

## 11 — Seed data

### Prompt
> "Rewrite the seed script. 16 users with real Indian names, mixed roles (about 4 managers, 12 members). Assign them to two projects (ACME Corp and Port Logistics). Create 30+ tasks across all statuses — BACKLOG, IN_PROGRESS, IN_REVIEW, DONE, BLOCKED — with some having due dates in the past (to trigger overdue alerts), some blocked by other tasks, and some with comments in the timeline. No Bob, no Alice."

### What I got
A complete `prisma/seed.js` with 16 users (Aarav, Ananya, Arjun, Priya, Vihaan, Diya, Aditya, Kavya, Rohan, Meera, Ishaan, Pooja, Karan, Nisha, Rahul, Sanya), 2 projects, and 32 tasks seeded with `upsert` (idempotent — re-running the seed does not duplicate data). Tasks span all statuses, several have past due dates to pre-populate the alert system, and one has a blocker relationship so the blocked/unblock flow is visible without setup.

### What I corrected
The initial seed script used `create` instead of `upsert`. Running `npx prisma db seed` twice would fail with unique constraint violations on `email`. Changed to `prisma.user.upsert({ where: { email }, create: {...}, update: {} })` for all users and `prisma.project.upsert({ where: { key }, create: {...}, update: {} })` for projects. Tasks use `createMany` with `skipDuplicates: true`.
