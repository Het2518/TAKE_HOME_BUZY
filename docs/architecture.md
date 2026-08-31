# Architecture

## Moving pieces and how they talk to each other

The system is a single Next.js 14 application that runs both the browser UI and the API in one deployment unit. There are three logical layers:

**1. Browser (React, client components)**
Pages under `src/app/(dashboard)/` and `src/app/(auth)/` are React client components. They fetch data from the API routes using the native `fetch` API. State management is entirely local — `useState` and `useEffect` — no Redux or external store. The only global state is the current user, fetched once from `/api/auth/me` and shared via a `useCurrentUser` hook.

**2. API (Next.js Route Handlers)**
Everything under `src/app/api/` is server-side code running in Node.js on the same process (or serverless function, on deployment). These are standard Next.js App Router `route.js` files. All database access happens here — the browser never touches Prisma or Postgres directly. Every route goes through `withErrorHandling` (converts `HttpError` throws to JSON responses) and `requireAuth` (reads and verifies the JWT from an httpOnly cookie).

**3. Database (PostgreSQL via Prisma)**
A single managed PostgreSQL database. Prisma is the ORM — `src/lib/prisma.js` exports a singleton `PrismaClient` instance (important: Next.js in dev mode hot-reloads, which would exhaust connections if a new client were created per module load). The schema is the single source of truth; there are no raw SQL queries in the codebase.

**Auth flow:** JWT stored in an httpOnly, SameSite=lax cookie (not localStorage — XSS-proof). The payload carries `{ userId, role }`. Every protected route handler calls `requireAuth()` which reads `cookies().get("session")`, verifies the JWT with `jsonwebtoken`, and returns the session. There is no refresh-token mechanism — the token expires in 7 days.

---

## Where each piece runs

| Piece | Where it runs |
|---|---|
| React pages | Browser (client bundle) |
| Next.js API route handlers | Node.js server (or Vercel serverless function) |
| Prisma client | Same Node.js process as the API — never in the browser |
| PostgreSQL database | Supabase (managed Postgres, free tier) |
| Full application | Vercel (Next.js deployment) |

On Vercel, the Next.js server and the API routes are the same deployment. The DB connection string is passed as the `DATABASE_URL` environment variable; it is never committed to the repository.

---

## Request path for one representative action: changing a task's status

Here is the exact path when a user clicks "Move to IN_REVIEW" on a task detail page:

1. **Browser** — `changeStatus("IN_REVIEW")` is called in `src/app/(dashboard)/tasks/[taskId]/page.js`. Before the network request even fires, the status badge is **optimistically updated** in local state so the UI feels instant.

2. **Browser → API** — `fetch("/api/tasks/:id/status", { method: "PATCH", body: { targetStatus: "IN_REVIEW" } })` is called. The httpOnly cookie is automatically attached by the browser.

3. **API route** — `src/app/api/tasks/[taskId]/status/route.js` runs:
   - `requireAuth()` reads and verifies the JWT cookie → gets `{ userId, role }`
   - `requireProjectAccess(session, task.projectId)` checks membership (or manager role)
   - `validateTransition(task.status, "IN_REVIEW", hasIncompleteBlockers, blockedFromStatus)` is called from `src/lib/taskStateMachine.js` — if the transition is illegal, a 422 with a human-readable reason is returned
   - If valid: `prisma.task.update(...)` writes the new status
   - `writeTaskEvent(...)` appends an immutable `STATUS_CHANGE` row to `TaskEvent`

4. **API → Browser** — `200 OK` with the updated task JSON is returned.

5. **Browser** — On success, `loadTask()` and `loadTimeline()` are both called to sync the full task state and the timeline from the server. On failure, the optimistic status update is **rolled back** to the previous status and the server's error message is displayed.

---

## What was deliberately not built

**Email digest** — Requires an email service (SendGrid, Resend, etc.) and a background job scheduler. The free hosting tier combination here (Vercel serverless + Supabase) has no persistent background process, so this would need a separate cron service. Not worth the complexity for the required goals.

**@-mentions in comments** — Requires parsing comment text server-side, detecting mentions, and either emailing or surfacing a notification system. The underlying comment infrastructure (immutable `TaskEvent` rows with `type: COMMENT`) exists; mentions would extend it. Left out as a time call.

**Time tracking** — No `TimeEntry` model exists. Would need a separate start/stop mechanism and aggregate queries. Not a required goal.

**Keyboard navigation** — Not built. Would require careful focus management and shortcut bindings across pages.

**Per-project custom fields** — Would need a polymorphic field storage design (e.g., `CustomField` + `CustomFieldValue` tables). Significant schema complexity for a stretch goal.

**@-mention notifications, cycle detection beyond single chain** — Cycle detection across the full blocking graph *is* implemented (`wouldCreateCycle` in `src/lib/taskStateMachine.js`, DFS over the adjacency map). The brief marks "cycle detection beyond a single blocking relationship" as optional; this implementation covers the full graph.
