# AI Prompts

I used an AI assistant throughout this project as a pair-programming tool — for scaffolding, debugging, and architectural questions. All significant prompts are recorded below in the order they were used, grouped by what I was trying to achieve.

---

## Reading and planning the brief

### Prompt
"Read through the whole brief in my zip. I'm instructed to build this project and task tracker. What do I do, how to do it, what's the plan for making this?"

### What I got
A full 6-session build plan ordered by dependency (auth before projects before tasks before workflow), with the reasoning that building in reverse would leave you retrofitting security. The AI also flagged immediately that the brief would test me on git history and docs — not just the app — and recommended treating it as pair-programming across sessions rather than generating a finished app at once.

### What I corrected
Nothing on the plan itself — the session ordering was sound. I pushed back on the tone ("don't just generate everything") and confirmed I wanted to build it step by step and be able to explain each piece.

---

## Stack selection

### Prompt
"Give me the best stack but I know MERN — I'll go for whatever's best for this. How comfortable are you with SQL / an ORM? Comfortable with both."

### What I got
A recommendation to switch from MongoDB to PostgreSQL + Prisma, keeping Node/React but replacing Mongo. The reasoning was specifically: many-to-many task blocking, join-heavy queries, and the brief's schema doc requirement ("justify which constraints live in DB vs. app code" is nearly impossible to answer honestly with Mongo). Also recommended Next.js over separate Vite + Express to collapse into one deployment.

### What I corrected
No correction needed — I agreed with the reasoning and the stack. This became Decision 1 and Decision 2 in `docs/decisions.md`.

---

## Auth and role enforcement

### Prompt
"Build the auth system — login, signup, JWT in httpOnly cookie, and the server-side requireAuth + requireRole middleware. Explain each piece."

### What I got
`src/lib/auth.js` (JWT sign/verify/cookie helpers) and `src/lib/permissions.js` (`requireAuth`, `requireRole`, `requireProjectAccess`, `withErrorHandling`). The explanation covered why httpOnly cookie over localStorage (XSS protection), why SameSite=lax (CSRF defence), and why the role is encoded in the JWT payload (avoids a DB hit on every request to check role).

### What I corrected
The initial `requireProjectAccess` implementation checked only project ownership, not membership — a manager who added themselves as a member of a project they didn't own couldn't access it. Fixed to check `ProjectMember` table for non-owners as well.

---

## Task state machine

### Prompt
"Build the task lifecycle state machine. Rules: BACKLOG → IN_PROGRESS → IN_REVIEW → DONE, can be BLOCKED from IN_PROGRESS or IN_REVIEW, unblocking returns to the prior state, DONE can be reopened, any task with an unfinished blocker cannot reach DONE. Server rejects illegal moves with a reason. UI only shows legal moves. Both must use the same logic."

### What I got
`src/lib/taskStateMachine.js` with three pure functions: `getLegalTransitions` (used client-side to render only valid buttons), `validateTransition` (used in the status route handler to enforce server-side), and `wouldCreateCycle` (stretch goal: DFS cycle detection on the blocking graph). The functions were written without any Node-only dependencies so they could be imported in both the API and the React component.

### What I corrected
Nothing structurally wrong, but I added two tests after the fact: one for DONE → IN_PROGRESS (reopening) and one for the edge case where a BLOCKED task has no `blockedFromStatus` stored (should return no legal moves). Both caught edge cases that weren't covered by the initial test suite.

---

## Search and filter — where the AI produced wrong output

### Prompt
"Build the GET /api/tasks route with server-side search, filter by project/status/assignee/priority/overdue, sort by dueDate/priority/updatedAt, and pagination."

### What I got (wrong part)
The initial route was correct, but the frontend `useEffect` that called it was wired directly to the search input's `onChange`. This meant every keystroke fired a full network request — which would visibly lag and hammer the DB. The issue was in the React component, not the API.

### What I corrected
Added a debounce layer (350ms timeout, cleared on each keystroke) with a separate `searchInput` state for the controlled input value and a `filters.search` state that only updates after the pause. Also added a `requestIdRef` guard so a slow old response could not overwrite a newer one (race condition). This is documented in the component with a comment. The final implementation is in `src/app/(dashboard)/tasks/page.js`.

---

## Overdue alerts and the reappear logic

### Prompt
"Build the alert system. Overdue tasks appear in an alert area with a count badge in the nav. A user can dismiss an alert for a task they're assigned to. If the task's due date changes after they dismissed it, the alert must reappear."

### What I got
`GET /api/alerts` and `POST /api/alerts/:taskId/dismiss`. The reappear logic was: compare `task.dueDateUpdatedAt > dismissal.dismissedAt`. Initially the AI stored `dueDateUpdatedAt` as part of the dismiss response, not on the `Task` model itself.

### What I corrected
Moving `dueDateUpdatedAt` onto the `Task` model directly (as a nullable DateTime column) rather than deriving it at query time. This was the cleaner design — a single column read on an already-loaded row rather than a correlated subquery into `TaskEvent`. The trade-off (must keep it in sync wherever `dueDate` is written) is managed by a deliberate check in every route that writes `dueDate`. This became Decision 6 in `docs/decisions.md`.

---

## Tests

### Prompt
"Write tests for the highest-risk parts of the codebase — the state machine, the status transition route, the bulk action route, the alert dismiss route, and the signup route. Use Vitest. The tests should run without a real database."

### What I got
49 tests across 5 files, using Vitest with vi.mock for Prisma and cookie/JWT. The state machine tests (`tests/taskStateMachine.test.js`) are exhaustive — every status combination with and without incomplete blockers. The route tests mock Prisma at the module level, inject controlled return values, and assert on the HTTP response status and body.

### What I corrected
The initial mock for `getSessionFromCookies` in the signup test was importing from the wrong path (`../lib/auth` instead of `../../src/lib/auth`). Fixed the import path. Also added a test for the case where signup is called with an already-existing email — the initial test suite only covered happy path and validation errors, not the 409 conflict case.
