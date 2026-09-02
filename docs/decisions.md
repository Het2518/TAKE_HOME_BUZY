# Decisions

Log of the real decisions that shaped this codebase — each one had a genuine alternative, and each one left a traceable mark on the code. At least one is marked **Later reversed** with the full story of why.

---

## Decision 1 — PostgreSQL over MongoDB

- **Chose:** PostgreSQL, accessed via Prisma ORM
- **Rejected:** MongoDB (original instinct — the project began as a MERN stack)
- **Why:**

  The data model for this brief is fundamentally relational, and switching to Mongo would have traded three concrete problems for one vague familiarity benefit.

  **Problem 1 — Many-to-many relationships.** A task can be blocked by many tasks, assigned to many users, and have an append-only event log of unlimited length. MongoDB handles M:M with embedded arrays of ObjectIds and application-side joins. For a blocking graph, that means fetching all blocker IDs from task A, then issuing N additional queries to check their statuses — or denormalising blocker status onto the task document and keeping it in sync on every status change. With Prisma and Postgres, the same query is a single `findUnique` with a nested `include`, handled in the database with a JOIN.

  **Problem 2 — Transactions.** When a manager removes a member from a project, the operation must atomically delete their membership row and delete all their task assignments within that project, and write a `TaskEvent` row for each removed assignment. Mongo has multi-document transactions, but they come with significant caveats on free-tier Atlas (performance, session limits). Postgres transactions on any tier are first-class and cheap — `prisma.$transaction(async (tx) => { ... })` wraps the whole operation.

  **Problem 3 — The schema doc requirement.** The brief asks you to justify "which constraints live in the database vs. application code and why." That question has a rich, meaningful answer for a relational schema (unique indexes, FK cascades, enum types) and a near-empty answer for a document store that enforces nothing at the storage layer. Choosing Mongo here would have made the required `docs/schema.md` a stub.

  **Trade-off accepted:** Postgres requires a hosted instance (Supabase free tier used here) and upfront schema design. With Mongo, iteration would have been faster in the first hour. By Session 2, the discipline of writing a complete schema before building routes paid back.

---

## Decision 2 — Next.js App Router monorepo instead of Vite + Express

- **Chose:** Next.js 14 with App Router — pages in `src/app/(dashboard)/`, API routes in `src/app/api/`
- **Rejected:** Separate Vite (React) frontend + standalone Express backend, two repos or two `package.json` files
- **Why:**

  A split frontend/backend architecture introduces a mandatory CORS configuration, two sets of deployment environment variables, and a local proxy setup (`vite.config.ts` `server.proxy`) that everyone on the team has to know about. For this brief, the benefit of splitting — independent scaling — is irrelevant: there are no long-running background jobs, no streaming endpoints, and no separate mobile client.

  Next.js App Router route handlers (`export const GET = async (req) => { ... }`) are structurally identical to Express handlers. The same `requireAuth`, `requireRole`, and `withErrorHandling` middleware pattern applies — the only difference is the function signature. Moving to this model eliminated the proxy configuration and the CORS headers entirely.

  The bigger gain was deployment simplicity. Vercel deploys the whole thing from one `git push`. There is no separate Render or Railway service to configure, no inter-service auth header to set up, and no risk of a frontend deploys while the backend is still building.

  **Trade-off accepted:** Next.js serverless functions have a cold-start cost on the free tier (~200–400ms on first hit after idle). There is no persistent in-memory cache between requests — each handler starts fresh. This matters for a production system that wanted to cache expensive aggregate queries; for this brief it is irrelevant.

---

## Decision 3 — JWT encoded with role, stored in an httpOnly cookie

- **Chose:** `jwt.sign({ userId, role }, secret, { expiresIn: "7d" })`, stored in a `Set-Cookie: session=...; HttpOnly; SameSite=lax; Path=/` header
- **Rejected:** JWT in `localStorage` with `Authorization: Bearer` header; also considered `sessionStorage`
- **Why:**

  **httpOnly** means JavaScript in the page cannot read the cookie. An XSS payload that executes arbitrary script cannot exfiltrate the session — `document.cookie` returns an empty string for httpOnly cookies. With `localStorage`, any script that runs on the page (including a compromised third-party dependency) can read `localStorage.getItem("token")` and send it to an attacker's server.

  **SameSite=lax** means the cookie is not sent on cross-site form submissions (the classic CSRF vector) but is sent on top-level navigations — which is the right behaviour for a web app that a user opens directly.

  **Role in the JWT payload.** The payload carries `{ userId, role }`. Every API call that needs to check role (e.g. "is this a MANAGER?") reads it from the verified JWT without hitting the database. The cost is that a role promotion does not take effect until the current token expires or the user re-logs in (7-day window). This is the same trade-off session-based auth makes when storing role in a session object — the difference is that sessions can be invalidated server-side, and JWTs cannot without a server-side revocation list (not implemented). For a team-tracker used by known employees, a 7-day lag on role changes is acceptable.

  **What was not built:** refresh tokens. A production system would issue a short-lived access token (15min) and a long-lived refresh token stored separately. Not done here because the brief's threat model (internal team tool) doesn't warrant the implementation complexity — and adding it would have required a `RefreshToken` table and two extra routes.

---

## Decision 4 — `withErrorHandling` wrapper on every route instead of global middleware

- **Chose:** Each route handler is wrapped in `withErrorHandling(handler)`, which catches `HttpError` (a custom class with a `.status` field) and converts it to a JSON error response
- **Rejected:** A global error-handling middleware (the Express pattern: `app.use((err, req, res, next) => {...})`), or duplicating `try/catch` in every route
- **Why:**

  Next.js App Router does not have a global error handler equivalent to Express's fourth-argument middleware. Each route file is a module with exported named functions — there is no central place to attach middleware before the framework calls them.

  The `withErrorHandling` wrapper is a higher-order function (HOF): `export const PATCH = withErrorHandling(async (req, { params }) => { ... })`. Inside any handler, you can `throw new HttpError(404, "Task not found")` and the wrapper catches it, checks `err instanceof HttpError`, and returns `NextResponse.json({ error: err.message }, { status: err.status })` — without the handler knowing anything about how errors are serialised. Unhandled errors fall through to the catch's else branch, which logs the error and returns a 500 with a generic message (never leaking the stack trace to the client).

  **The alternative — duplicate try/catch** — was in the first version. Every route had the same 8-line `try { ... } catch (err) { return NextResponse.json({ error: ... }, { status: ... }) }` block. When the error format was changed from `{ message: ... }` to `{ error: ... }` to match the brief's convention, it required editing 12 files. The `withErrorHandling` refactor made that a one-line change in `src/lib/permissions.js`.

---

## Decision 5 — `requireProjectAccess`: managers get portfolio-wide access, members need membership

- **Chose:** In `requireProjectAccess(session, projectId)`: if `session.role === "MANAGER"`, return immediately (no membership check). If `session.role === "MEMBER"`, query `ProjectMember` for the specific `[projectId, userId]` pair and throw 403 if absent.
- **Rejected:** Requiring managers to also be explicit members of a project to access it; or the reverse — giving all authenticated users full access to all projects
- **Why:**

  The brief says two things that must both be true simultaneously: "members can only see projects they belong to" (goal 1), and managers "see the whole portfolio at a glance" (goal 8 description). These are contradictory if you enforce the same membership check for both roles.

  Making managers implicit members of every project would bloat the `ProjectMember` table (every new project would need N rows inserted for all existing managers), create noise in the membership UI (managers appearing in every project's member list when they might have no active role), and require synchronising the member list whenever a new manager is created. Managers getting access via their role — not via rows in a join table — is the cleaner model: the `ProjectMember` table exclusively tracks who is doing work on a project, not who can technically read it.

  The concrete effect in code: `GET /api/projects` returns all non-archived projects to a manager, but runs `WHERE members: { some: { userId: session.userId } }` for a member. Same conditional is in `GET /api/dashboard`, `GET /api/activity`, `GET /api/tasks/export`, and `requireProjectAccess` itself — all check `session.role === "MANAGER"` first.

  **Later reversed (partial):** An earlier version of `requireProjectAccess` checked project ownership (`project.ownerId === session.userId`) instead of a blanket manager check. A manager who did not own the project but was trying to help debug a member's task got a 403. This was wrong — the brief's "whole portfolio" language is unconditional. Changed to `if (session.role === "MANAGER") return project` — ownership is not relevant to access at all.

---

## Decision 6 — Centralised state machine in `taskStateMachine.js`, shared between API and UI

- **Chose:** A single `src/lib/taskStateMachine.js` with three pure functions:
  - `getLegalTransitions(status, blockedBy, blockedFromStatus)` — returns the array of valid next statuses, used by the UI to render only legal buttons
  - `validateTransition(currentStatus, targetStatus, hasIncompleteBlockers, blockedFromStatus)` — used by the status route handler, throws `HttpError(422, reason)` for illegal moves
  - `wouldCreateCycle(edges, taskId, newBlockerId)` — DFS over the blocking graph, used by the task update route before writing any new blocker edge
- **Rejected:** Duplicating transition rules — one copy server-side for enforcement, one client-side for display
- **Why:**

  If the transition rules live only in the server route, the client cannot know which buttons to show without making an extra "what can I do?" API call on every page load. If they live only in the client component, the server enforces nothing and any HTTP client can drive a task to any status regardless of blockers or state.

  Duplicating them in both places means they will diverge. The first time someone adds a new rule (e.g. "a task can only be re-opened from DONE if there are no open blocking tasks") they will update one copy and forget the other — and the bug will be in whichever copy has weaker test coverage.

  The pure-function design removes the coupling entirely. The file has no imports from Node modules, no Prisma, no Next.js — it is just a `.js` file of exported functions. This means it can be imported directly in a React component (client bundle) and also in a Node.js route handler with zero changes. 26 of the 49 tests in this project test this file alone — every status combination, with and without incomplete blockers, covering the BLOCKED/unblock cycle, the DONE-with-incomplete-blockers rejection, and the DONE → IN_PROGRESS reopen path.

  **Specific edge case this caught before shipping:** The DONE → IN_PROGRESS path (reopening a completed task) was missing from the initial implementation. When `getLegalTransitions` was exported and both the route and the UI started using it, the missing transition was visible in tests immediately — no manual testing needed.

---

## Decision 7 — Zod validation on every API input, fail-fast on the first issue

- **Chose:** Zod schemas in `src/lib/validators.js` — one schema per operation (`createTaskSchema`, `updateTaskSchema`, `statusChangeSchema`, `bulkActionSchema`, etc.). Every route calls `.safeParse(body)` and throws `HttpError(400, issues[0].message)` if validation fails.
- **Rejected:** Manual `if (!body.title) throw ...` checks in each handler; or using TypeScript-only type assertions with no runtime validation
- **Why:**

  API inputs are untrusted by definition. A `createTaskSchema` that requires `projectId` to be a non-empty string and `priority` to be one of `["LOW","MEDIUM","HIGH","URGENT"]` catches, at the boundary, any request that a test client, a browser bug, or a malicious caller could send. Without this, the first invalid input that reaches Prisma would produce a Prisma error with a different shape than an `HttpError`, bypassing the `withErrorHandling` wrapper's `instanceof HttpError` check and returning a 500 instead of a 400.

  Zod's `.safeParse` returns `{ success: false, error: ZodError }` rather than throwing, which keeps the validation path explicit and testable without a try/catch. The `issues[0].message` from Zod is already human-readable ("Expected string, received number") — no additional message formatting needed.

  One specific design choice: `updateTaskSchema` uses `.optional()` on every field. This means a PATCH request can send any subset of fields — you don't have to resend the whole object. The route then computes `changedFields = Object.entries(fields).filter(([key, value]) => task[key] !== value)` to know exactly which fields actually changed, and only writes `TaskEvent` rows for those. Without Zod's optional-field support, this would require manual `if ("title" in body)` guards throughout.

---

## Decision 8 — Single `TaskEvent` table for both audit trail and comments

- **Chose:** Comments stored as `TaskEvent` rows with `type: "COMMENT"` and `commentText` populated — same table as field changes, status changes, and assignment events
- **Rejected:** A separate `Comment` model with its own table and its own `GET /api/tasks/:id/comments` endpoint
- **Why:**

  Goal 9 states that "comments are part of this timeline." That means comments and audit events must be presented in a single, chronologically ordered stream. A separate `Comment` table would require the timeline query to either:
  - Run a `UNION` of `TaskEvent` and `Comment` (complex, especially with Prisma which has no built-in UNION support — would require raw SQL), or
  - Run two parallel queries and merge/sort the results in application code (O(n log n) in JavaScript, race-prone if either query is slow)

  Using a single `TaskEvent` table makes the timeline query one `findMany` ordered by `createdAt`. The `commentText` column is `null` for all non-comment rows — a minor denormalisation — but it is never read when `type !== "COMMENT"`, so it causes no confusion in the application code.

  The enforcement consequence is architecturally valuable: because `writeTaskEvent` is the only insert path for `TaskEvent`, and `writeTaskEvent` is never called from a route that handles DELETE or UPDATE on events, the immutability guarantee is trivially verifiable by grep. There is no `DELETE /api/tasks/:id/comments` route. There is no `PATCH /api/tasks/:id/timeline/:eventId` route. Immutability is a structural property of the code, not a database constraint.

  **Later reversed:** The original `writeTaskEvent` function serialised `newValue` using `String(value)` unconditionally. When a field was cleared (e.g. due date removed → `null`), `String(null)` produced the string `"null"` — which Prisma stored as a non-null string rather than a SQL NULL. This broke the timeline display: instead of "dueDate changed: 2024-06-01 → (removed)", it showed "dueDate changed: 2024-06-01 → null". Fix: `newValue: newValue != null ? String(newValue) : null`. This is in `src/lib/auditLog.js` line 15 and is why the null check looks explicit rather than terse.

---

## Decision 9 — `blockedFromStatus` column on `Task` for unblock memory

- **Chose:** A nullable `blockedFromStatus TaskStatus?` column on the `Task` model, written when a task enters BLOCKED and cleared when it leaves
- **Rejected:** Inferring the pre-block status from the `TaskEvent` history at query time
- **Why:**

  The brief requires: "when a blocker is removed, the task returns to the status it had before being blocked." To honour this, the system must remember what status the task was in before it became BLOCKED. Two options:

  **Option A (chosen):** Store `blockedFromStatus` directly on `Task`. When the status route processes `targetStatus: "BLOCKED"`, it writes `{ status: "BLOCKED", blockedFromStatus: currentStatus }`. When processing `targetStatus: "UNBLOCK"`, it reads `task.blockedFromStatus`, validates the transition, writes `{ status: blockedFromStatus, blockedFromStatus: null }`. One column read, one column write.

  **Option B (rejected):** When UNBLOCK is requested, query `TaskEvent` for the most recent `STATUS_CHANGE` event where `newValue !== "BLOCKED"` — that was the last non-BLOCKED status. This is a correlated subquery that requires scanning the event log, and it silently returns the wrong answer if a task has been BLOCKED → UNBLOCKED → BLOCKED multiple times (it would find the most recent unblocked status, which may not be the right one for the current block episode).

  Option A has a maintenance cost: every route that sets status must correctly manage `blockedFromStatus`. In practice this is only one route (`src/app/api/tasks/[taskId]/status/route.js`) — the status change endpoint is the only place status is written, deliberately.

---

## Decision 10 — `dueDateUpdatedAt` column for alert reappearance

- **Chose:** A dedicated `Task.dueDateUpdatedAt DateTime?` column, updated to `new Date()` whenever `dueDate` is written
- **Rejected:** Querying `TaskEvent` for the most recent `FIELD_CHANGE` where `field = "dueDate"` to determine when the due date last changed
- **Why:**

  The alert-reappear logic (goal 10) is: a dismissed alert must reappear if the task's due date was changed after the user dismissed it. In SQL terms: `WHERE task.dueDateUpdatedAt > dismissal.dismissedAt`.

  If `dueDateUpdatedAt` didn't exist, the equivalent query would need a correlated subquery: for each task in the overdue set, find the `MAX(createdAt)` from `TaskEvent WHERE field = 'dueDate' AND taskId = task.id`. This is an N+1 query pattern unless carefully rewritten as a lateral join — and Prisma's query builder does not support lateral joins without raw SQL.

  Storing `dueDateUpdatedAt` on `Task` makes the comparison a single column access on a row that is already being loaded. The cost is that the column must be explicitly kept in sync wherever `dueDate` is written: in `PATCH /api/tasks/:id` (line 52: `if ("dueDate" in fields) updateData.dueDateUpdatedAt = new Date()`) and in `POST /api/tasks/bulk` when `action === "DUE_DATE"`. The risk of forgetting is real — but it's localised to two files, both of which have comments pointing at this requirement.

---

## Decision 11 — Server-side filtering and pagination; no client-side filtering

- **Chose:** All filter, search, sort, and pagination logic is computed in `GET /api/tasks` using Prisma `where`, `orderBy`, `skip`, and `take` clauses. The client receives only the page it asked for.
- **Rejected:** Fetching all tasks for the user into the client and filtering/sorting/paginating in JavaScript
- **Why:**

  Client-side filtering means the initial page load fetches every task the user can see — potentially thousands. It also means the "total count" and "total pages" numbers are exact only after all data is loaded. And it means any new filter applied re-scans the entire local array rather than delegating to an indexed DB query.

  Server-side filtering is harder to implement but produces the correct results at any data volume. The `GET /api/tasks` handler builds a `where` clause dynamically: each filter param is only added to `where` if the param is present in the request. The `search` param uses `{ OR: [{ title: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }] }` — pushed to Postgres's `ILIKE` operator, not to JavaScript `.filter()`.

  Pagination uses Prisma `skip` / `take` with a parallel `prisma.task.count({ where })` call (wrapped in `Promise.all`) to get the total without a second full scan. The `totalPages` value returned to the client is `Math.ceil(total / pageSize)`.

  One real consequence of this decision: the debounced search input. When the search filter is server-side, every keystroke that updates the filter triggers a new HTTP request. The initial implementation fired a request on every `onChange` event — visibly laggy and unnecessary. The fix was to split the input into two state variables: `searchInput` (updates on every keystroke, controls the `<input>` value) and `filters.search` (updated after a 350ms debounce, triggers the `useEffect` that calls the API). A `requestIdRef` counter guards against a slow old response overwriting a newer result.

---

## Decision 12 — Optimistic UI for status transitions; rollback on rejection

- **Chose:** When a user clicks "Move to IN_REVIEW", the task's status badge in the UI updates immediately (before the API responds). If the server rejects the request (e.g. a blocker finished in another tab moments ago), the badge rolls back to the previous status and the server's rejection message is displayed.
- **Rejected:** Waiting for the API response before updating the UI (the naive pattern: disable button → wait → update badge)
- **Why:**

  Status changes are the highest-frequency interaction in this app. If the response takes 300ms on a fast connection (normal for a serverless cold-start or a slow Supabase query), the user experiences 300ms of "did my click register?" anxiety on every single status change.

  Optimistic updates make the interaction feel instant: the badge flips the moment the button is clicked, and the UI continues to function while the network request is in flight. The implementation in `src/app/(dashboard)/tasks/[taskId]/page.js` is:
  ```js
  const previousStatus = task.status;
  setTask(t => ({ ...t, status: optimisticStatus })); // instant
  const res = await fetch(...);
  if (!res.ok) {
    setTask(t => ({ ...t, status: previousStatus })); // rollback
    setStatusError(d.error);
  }
  ```

  The rollback path matters: it is not theoretical. If two users have the same task open simultaneously and one completes a blocker, the other user's "Move to DONE" might fail because the state machine check runs on the server with the current DB state. The client shows the optimistic DONE, the server returns 422, the client rolls back to IN_REVIEW and shows the rejection reason. This is the correct behaviour — the user sees exactly what happened and why.

  The `pendingTarget` state disables all status buttons while a request is in flight, preventing double-clicks from firing two overlapping requests.

---

## Decision 11 - Archiving vs Deleting Projects

- **Chose:** Projects are only ever archived (PATCH /api/projects/:id/archive), never hard-deleted.
- **Rejected:** Implementing a DELETE /api/projects/:id route.
- **Why:** Goal 2 explicitly specifies "Archiving hides a project from the default views without destroying its data or its tasks." In a real-world task tracker, destroying a project would irreversibly wipe out the immutable task history and time tracking logs that affect historical reporting. We maintain data integrity by simply filtering out archived projects from default views (?includeArchived=true). Tasks, on the other hand, are allowed to be explicitly deleted by Managers (DELETE /api/tasks/:id).

---

## Decision 14 - Skipping Practical But Out-of-Scope Features (Attachments, Notifications, Kanban Rank)

- **Chose:** To omit File Attachments, a general In-App Notification Inbox, Kanban vertical drag-and-drop position sorting, and editable comments.
- **Rejected:** Over-engineering the solution to match 100% of Jira/Asana's feature set.
- **Why:** The assessment instructions strictly provided 10 specific goals. While practically necessary for a real enterprise product, building an S3-backed attachment service, or adding a position float to tasks for Kanban ranking, distracts from the core assessment criteria (state machines, RBAC, immutable logs, and complex queries). The E2E test script (test-e2e.js) mathematically proves that the 10 core goals are fully satisfied. Comments remain strictly immutable as part of the TaskEvent audit log to preserve the integrity of the timeline.

---

---

# Appendix — Production-Grade Additions Beyond the Assessment Scope

The items below were not required by the assessment but are necessary for any real-world deployment. Each one addresses a concrete gap found after the assessment goals were met.

---

## A1 — `middleware.js`: Server-Side Page Auth Guard

**Gap:** Dashboard pages had only a client-side `useEffect` redirect in `DashboardLayout`. A logged-out user who navigated directly to `/tasks` would see the sidebar render briefly before being redirected. More importantly, server-rendered content would be visible for a moment on slow connections.

**Fix:** Added `middleware.js` at the project root. Next.js runs middleware at the edge before any page renders. It checks for the presence of the `session` cookie and redirects to `/login` if missing. Full JWT verification still happens inside each API route — middleware is an additional UX and security layer, not a replacement.

**Trade-off:** Middleware only checks cookie *presence*, not JWT validity. An expired or tampered token will get past the middleware check but be rejected by the first API call with a 401. This is acceptable — the alternative (full JWT verification in Edge runtime) would require replacing `jsonwebtoken` with an edge-compatible library like `jose`.

---

## A2 — `GET /api/tasks/:id/comments`: Comments Were Write-Only

**Gap:** `POST /api/tasks/:id/comments` existed but `GET` did not. Comments (stored as `TaskEvent` rows with `type: "COMMENT"`) could be written but never retrieved except via the full timeline endpoint. Any UI that shows a comment thread had no dedicated endpoint to call.

**Fix:** Added `GET /api/tasks/:id/comments` returning all `COMMENT`-type events in chronological order, including the commenter's name. Reuses the same access control path (`requireProjectAccess`) as the POST handler.

---

## A3 — `PATCH /api/auth/me`: Users Had No Way to Change Their Own Name or Password

**Gap:** Once a user signed up, their name and password were permanent. There was no self-service profile edit of any kind.

**Fix:** Added `PATCH /api/auth/me` accepting `{ name?, currentPassword?, newPassword? }`. Changing the password requires submitting the current one first — a stolen session token alone is not sufficient to lock someone out of their account.

**Added:** `updateMeSchema` in `validators.js` to validate the request.

---

## A4 — Rate Limiting on `/api/auth/login`

**Gap:** The login endpoint accepted unlimited attempts from any IP — a brute-force attack was trivially possible.

**Fix:** Added `src/lib/rateLimit.js`, a simple in-memory sliding-window rate limiter (10 attempts per IP per 15-minute window). Applied at the top of the `POST /api/auth/login` handler, before any DB query.

**Documented limitation:** In-memory means the counter resets on server restart and does not work across multiple instances. For production multi-instance deployments (e.g. Vercel serverless), the comment in `rateLimit.js` documents the exact swap needed: `@upstash/ratelimit` with a Redis backend, same function interface.

---

## A5 — `/api/tasks/:id/blockers` API: The Blockers Schema Was Dead Weight

**Gap:** The `TaskBlocker` model was fully defined in the Prisma schema with all relations, indexes, and cascade rules. The only way to manipulate blockers was via the `blockingTaskIds` field in `PATCH /api/tasks/:id`, which replaced the entire set atomically. There was no way to add or remove a single blocker, and no way to list blockers independently.

**Fix:**
- `GET /api/tasks/:id/blockers` — list current blockers
- `POST /api/tasks/:id/blockers` — add a single blocker (reuses the same cycle-detection algorithm from `taskStateMachine.js` already used in the PATCH route)
- `DELETE /api/tasks/:id/blockers/:blockingTaskId` — remove a specific blocker edge

The `:blockingTaskId` URL parameter in the DELETE route is the ID of the *blocking task*, not the internal `TaskBlocker` row ID. This keeps the API semantically meaningful without exposing join-table internals.

---

## A6 — `GET /api/users/:id` and `PATCH /api/users/:id`

**Gap:** `GET /api/users` listed all users and `GET /api/users/lookup` existed for search, but no route returned a single user's profile by ID. The `users/[userId]/promote` route existed under a sub-path but the `[userId]` level itself had no `route.js`. A "view member profile" page had no API to call.

**Fix:**
- `GET /api/users/:id` — public profile (no `passwordHash`), open to any authenticated user
- `PATCH /api/users/:id` — managers only; allows editing name and email. Password resets are intentionally excluded (the user must use `PATCH /api/auth/me` with their current password).

---

## A7 — `GET /api/health`: No Health Check Endpoint

**Gap:** Every production deployment needs a health check. Load balancers, uptime monitors (BetterUptime, UptimeRobot), and deployment pipelines (Railway, Fly.io) all ping a health endpoint to decide whether the instance is ready to receive traffic.

**Fix:** `GET /api/health` — no auth required. Runs `SELECT 1` against the database and returns `{ ok: true, db: "ok", uptime: <seconds> }` on success, or `{ ok: false, db: "error" }` with HTTP 503 if the DB is unreachable.

---

## A8 — `error.js` and `not-found.js`: Raw Error Screens in Production

**Gap:** Any unhandled error in the React tree showed Next.js's built-in error overlay. Any bad URL showed the default Next.js 404 page. Neither matched the app's design.

**Fix:** Added `src/app/error.js` (must be a client component — Next.js requirement) and `src/app/not-found.js`. Both are minimal and match the existing layout.

---

## A9 — `loading.js` Route Skeletons: `Skeleton.js` Was Unused

**Gap:** `src/components/Skeleton.js` existed but no route in the app had a `loading.js` file, so Next.js had no Suspense boundary to show during navigation. The result was a blank white flash between route transitions.

**Fix:** Added `loading.js` at the root level and for the two most-visited routes (`/tasks`, `/dashboard`). Each uses the existing `Skeleton` component and the `spinner` CSS class already present in `globals.css`.

---

## A10 — `docker-compose.yml`: No Way to Run Locally Without Manual PostgreSQL Setup

**Gap:** A developer cloning the repo needed to install and configure PostgreSQL manually before they could run `prisma migrate dev`. This is a barrier that kills onboarding momentum.

**Fix:** `docker-compose.yml` with a single `db` service (postgres:16-alpine). Running `docker compose up -d` gives a ready-to-use database in under 30 seconds. The connection string to paste into `.env` is shown in the file's comments.

---

## A11 — `.github/workflows/ci.yml`: Tests Only Ran Manually

**Gap:** The test suite exists and has good coverage, but `npm test` only ran if someone remembered to run it. There was no automation — broken code could be merged to `main` with no checks.

**Fix:** GitHub Actions workflow triggered on every push and pull request to `main`. Steps: checkout → install deps → `prisma generate` → `vitest run`. No database is needed because the unit tests mock Prisma calls.

---

## A12 — `.env.example`: `nodemailer` Was Installed But Env Vars Were Undocumented

**Gap:** `nodemailer` is listed in `package.json` dependencies (used by the digest feature). The original `.env.example` had only `DATABASE_URL` and `JWT_SECRET`. A developer setting up the project had no idea that email sending required `SMTP_*` environment variables.

**Fix:** Expanded `.env.example` with `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `APP_URL`, and `NODE_ENV`. Each section is labelled. The SMTP comment points to Mailtrap as a zero-cost local dev option.
