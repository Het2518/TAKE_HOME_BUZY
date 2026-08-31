# Decisions

## Decision 1 — PostgreSQL over MongoDB

- **Chose:** PostgreSQL (via Prisma ORM)
- **Rejected:** MongoDB (original instinct given MERN background)
- **Why:** The data model for this brief is fundamentally relational. A task can be blocked by many tasks, assigned to many users, belong to exactly one project, and carry an append-only audit trail — that's three many-to-many relationships and a join-heavy query pattern. MongoDB handles this with references and application-side joins, but the brief explicitly asks you to "justify which constraints live in the database vs. application code" — a meaningful question for relational schemas, a non-question for document stores. Postgres also gave real transactions (needed for the remove-member + unassign-cascade operation) and `@@unique` constraints for deduplication without application-side guards.

---

## Decision 2 — Next.js App Router for both frontend and API (monorepo, not separate repos)

- **Chose:** Next.js with App Router, API routes in `src/app/api/`
- **Rejected:** Separate Vite (React) frontend + Express backend
- **Why:** A single codebase means one deployment, one set of environment variables, one `package.json`, and shared TypeScript/JS types if the project ever grows. Next.js App Router route handlers are essentially Express handlers with a different signature — the auth, error-handling, and permission-checking patterns are identical. Keeping them co-located meant no CORS configuration, no proxy setup in development, and no Vercel-vs-Render cross-origin cookie headaches. The trade-off is that route handlers run in Next.js's serverless context, which limits long-running background jobs — but this app has none.

---

## Decision 3 — JWT in an httpOnly cookie, not localStorage

- **Chose:** `jwt.sign({ userId, role })` stored in an httpOnly, SameSite=lax cookie
- **Rejected:** Token in localStorage, or in a header managed by the client
- **Why:** httpOnly means JavaScript cannot read the token — XSS cannot steal the session. SameSite=lax defends against CSRF on the most common form-submission attack. The alternative (localStorage + `Authorization: Bearer` header) is simpler to implement but exposes the token to any script that runs on the page. The role is encoded in the JWT payload (`{ userId, role }`), which means the API does not need to hit the database to check authorization on most requests — the role is verified by `requireAuth()` purely from the JWT. The risk is that a role change (e.g., a member promoted to manager) doesn't take effect until the current token expires (7 days). This is an acceptable trade-off given the team size the brief describes.

---

## Decision 4 — Centralised state machine (`taskStateMachine.js`) shared between API and UI

- **Chose:** A single `src/lib/taskStateMachine.js` with pure functions (`getLegalTransitions`, `validateTransition`, `wouldCreateCycle`) imported by both the API route and the client component
- **Rejected:** Duplicating the transition logic — one copy in the route handler (for enforcement) and one in the component (for rendering only legal buttons)
- **Why:** The brief explicitly warns that "the interface should only offer the moves that are currently legal" — which means the UI needs the same rules as the server. If they're duplicated, they drift. The pure-function design makes the state machine testable without a database or an HTTP request — 26 of the 49 tests are entirely against this one file, covering every status/blocker combination. The one cost is that the server file is imported client-side, which means it must not reference any Node-only module (it doesn't — it's pure JS).

---

## Decision 5 — Single `TaskEvent` table for both audit trail and comments

- **Chose:** Comments are stored as `TaskEvent` rows with `type: COMMENT` and `commentText` populated
- **Rejected:** A separate `Comment` model with its own table
- **Why:** Goal 9 says "comments are part of this timeline" — which means they must appear in the same ordered stream as field changes, status changes, and assignments. A separate `Comment` table would require a UNION query or application-side merge and sort every time the timeline is rendered. Using a single `TaskEvent` table means the timeline query is one `findMany` ordered by `createdAt` — no merge needed. The `commentText` column is null for all non-comment event types; this is a minor denormalisation trade-off, but the column is never read when `type !== COMMENT`, so it causes no confusion in practice. The enforcement consequence is that there is no `DELETE /api/tasks/:id/comments` route at all — `writeTaskEvent` is the only write path, and it is never called from a DELETE handler.

**Later reversed:** An earlier version of the `writeTaskEvent` helper accepted `newValue` as any type and converted it to string inside the helper using `String(value)`. This caused a bug where `null` would be stored as the string `"null"` rather than a SQL NULL — which broke the timeline display for fields that were being cleared. The fix was to explicitly check `!= null` before calling `String()`: `newValue: newValue != null ? String(newValue) : null`. This change is in `src/lib/auditLog.js` line 15.

---

## Decision 6 — `dueDateUpdatedAt` column for alert reappearance, not a query over `TaskEvent`

- **Chose:** A dedicated `Task.dueDateUpdatedAt` timestamp column, written every time `dueDate` changes
- **Rejected:** Querying `TaskEvent` for the latest `FIELD_CHANGE` on `field = "dueDate"` to find when the due date last changed
- **Why:** The alert query needs to compare "when was this task's due date last changed" against "when did the user dismiss the alert." If this were derived from `TaskEvent`, the query would require a correlated subquery or a lateral join per task — expensive and complex. Storing `dueDateUpdatedAt` directly on `Task` makes the comparison a single column read on an already-loaded row. The trade-off is a denormalisation that must be kept in sync — every route that writes `dueDate` must also write `dueDateUpdatedAt`. This is enforced in the PATCH handler (`src/app/api/tasks/[taskId]/route.js` line 52) and the bulk handler, using the check `if ("dueDate" in fields) updateData.dueDateUpdatedAt = new Date()`.
