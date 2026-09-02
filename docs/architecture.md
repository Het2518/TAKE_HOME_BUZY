# Architecture

## Moving pieces and how they talk to each other

This is a **single Next.js 14 application** — there is no separate backend server, no API gateway, no separate frontend repository. The browser, the API, and the build toolchain are all in one codebase. Here is the full picture:

```mermaid
flowchart TB
    subgraph Client [Browser - React Client Components]
        UserAction[User Interaction \n e.g. 'Change Task Status']
        State[React State \n Optimistic UI Update]
        Fetch[Native fetch() API]

        UserAction --> State
        State --> Fetch
    end

    subgraph Middleware [Security & Validation Pipeline]
        withErrorHandling{withErrorHandling \n Global Try/Catch}
        requireAuth{requireAuth \n Parse JWT HttpOnly Cookie}
        requireAccess{requireRole / requireProjectAccess \n DB Membership Check}
        Zod{Zod Validation \n safeParse request body}

        Fetch -- "HTTP Request (JSON)" --> withErrorHandling
        withErrorHandling --> requireAuth
        requireAuth -- "Missing/Expired" --> HTTP401[401 Unauthorized]
        requireAuth -- "Valid" --> requireAccess
        requireAccess -- "Denied" --> HTTP403[403 Forbidden]
        requireAccess -- "Allowed" --> Zod
        Zod -- "Schema Error" --> HTTP400[400 Bad Request]
    end

    subgraph BusinessLogic [Core Application Logic]
        StateMachine{Business Rules \n Validate State Transitions \n Check Blockers}
        Prisma[Prisma ORM \n DB Operations]
        Audit[writeTaskEvent \n Immutable Audit Log]

        Zod -- "Valid Data" --> StateMachine
        StateMachine -- "Constraint Violation" --> HTTP422[422 Unprocessable]
        StateMachine -- "Valid Transition" --> Prisma
        Prisma --> Audit
    end

    subgraph Database [Database Layer]
        DB[(PostgreSQL)]
        Prisma <--> DB
    end

    Audit -- "Return Updated Data" --> Response[NextResponse.json]
    Response -- "HTTP 200 OK" --> Fetch
    Fetch -- "Sync Real Data" --> State

    HTTP401 --> Fetch
    HTTP403 --> Fetch
    HTTP400 --> Fetch
    HTTP422 --> Fetch

    classDef client fill:#0f172a,stroke:#3b82f6,stroke-width:2px,color:#fff;
    classDef middleware fill:#3f3f46,stroke:#f59e0b,stroke-width:2px,color:#fff;
    classDef logic fill:#14532d,stroke:#10b981,stroke-width:2px,color:#fff;
    classDef db fill:#4c1d95,stroke:#8b5cf6,stroke-width:2px,color:#fff;
    classDef error fill:#7f1d1d,stroke:#ef4444,stroke-width:2px,color:#fff;

    class Client,UserAction,State,Fetch client;
    class Middleware,withErrorHandling,requireAuth,requireAccess,Zod middleware;
    class BusinessLogic,StateMachine,Prisma,Audit logic;
    class Database,DB db;
    class HTTP401,HTTP403,HTTP400,HTTP422 error;
```

---

### 1. Browser layer (React client components)

Pages in `src/app/(dashboard)/` and `src/app/(auth)/` are all React client components (`"use client"` at the top of each file). They render in the browser after an initial HTML shell is served by Next.js.

**State management** is entirely local: `useState`, `useEffect`, and `useCallback`. There is no Redux, no Zustand, no React Context for anything except the current user. The `useCurrentUser` hook (`src/hooks/useCurrentUser.js`) calls `GET /api/auth/me` once on mount and caches the result in component state. All child components that need the user call this hook — the request is deduplicated at the browser HTTP cache level (same URL, same session cookie).

**Data fetching** is plain `fetch()` — no React Query, no SWR. Each page manages its own loading state with an `isLoading` boolean and an `isLoading ? 0.5 : 1` opacity fade on the data container. The All Tasks page additionally uses a `requestIdRef` integer counter to discard stale responses: every fetch increments the counter; the `.then()` handler checks that its counter value still matches the current counter before calling `setTasks()`. Without this guard, a fast keystroke followed by a slow network could show results from the previous query.

**Optimistic updates** are used on task status changes (the highest-frequency interaction). The status badge flips immediately on click; if the server rejects the transition, the badge rolls back to the previous value and the rejection message is shown. This is entirely in the client component — the server does not know the client pre-updated.

**Theme** (dark/light) is managed by the `useTheme` hook (`src/hooks/useTheme.js`), which reads from `localStorage` on mount, applies a `data-theme` attribute to `<html>`, and toggles on button click. CSS custom properties (`--bg`, `--panel`, `--text`, etc.) in `src/app/globals.css` switch between the two palettes. The toggle is in the nav bar of every dashboard page via `src/app/(dashboard)/layout.js`.

---

### 2. API layer (Next.js Route Handlers, server-side Node.js)

Everything under `src/app/api/` is server-side code. In development, it runs in the same Node.js process as the Next.js dev server. In production on Vercel, each `route.js` file becomes a serverless function (one function per file, auto-scaled by Vercel). The browser never imports any of these files — they are excluded from the client bundle entirely.

**Edge middleware (`middleware.js` at project root):**

Before any page or API route runs, `middleware.js` intercepts requests to protected paths (`/dashboard/*`, `/tasks/*`, etc.) and redirects to `/login` if the `session` cookie is absent. This eliminates the client-side redirect flash that `DashboardLayout` previously caused via a `useEffect`. Full JWT verification still happens inside each route handler — middleware is a cookie-presence guard only, not a replacement for `requireAuth()`.

**Middleware chain applied to every API route handler:**

```
withErrorHandling(
  checkRateLimit(ip)          ← login route only: 10 attempts / 15 min per IP
  requireAuth()               ← reads JWT cookie, returns { userId, role }
  requireRole(session, ...)   ← optional, for manager-only routes
  requireProjectAccess(...)   ← optional, checks project membership
  [business logic]
  prisma.something(...)
  writeTaskEvent(...)          ← for any route that mutates state
  return NextResponse.json(...)
)
```

`withErrorHandling` is a higher-order function that wraps the handler in a try/catch. Any `throw new HttpError(status, message)` anywhere inside becomes `NextResponse.json({ error: message }, { status })`. Unhandled errors become 500s with the stack trace logged server-side but never sent to the client.

**Input validation** uses Zod (`src/lib/validators.js`). Every route that accepts a body calls `.safeParse(body)` on a named Zod schema. The first validation error is thrown as an `HttpError(400, issues[0].message)`. This means the client always gets a readable English error string, never a Zod internal object.

**Current API surface (30 route files):**

| Route | Methods | Purpose |
|---|---|---|
| `/api/auth/login` | POST | Issue JWT cookie (rate-limited) |
| `/api/auth/signup` | POST | Create MEMBER account, issue JWT |
| `/api/auth/logout` | POST | Clear session cookie |
| `/api/auth/me` | GET, **PATCH** | Get/update own profile + password |
| `/api/projects` | GET, POST | List/create projects |
| `/api/projects/[id]` | GET, PATCH | Get/edit one project |
| `/api/projects/[id]/archive` | PATCH | Archive/restore |
| `/api/projects/[id]/members` | POST, DELETE | Add/remove member (+ cascade unassign) |
| `/api/tasks` | GET, POST | Filtered list + create |
| `/api/tasks/bulk` | POST | Bulk status/assignee/dueDate change |
| `/api/tasks/export` | GET | CSV of current filtered view |
| `/api/tasks/[id]` | GET, PATCH, DELETE | Single task CRUD |
| `/api/tasks/[id]/status` | PATCH | Status transition (state machine) |
| `/api/tasks/[id]/assignees` | POST, DELETE | Add/remove single assignee |
| `/api/tasks/[id]/comments` | **GET**, POST | **Read** comments / append to timeline |
| `/api/tasks/[id]/blockers` | **GET, POST** | **List/add blocker** (with cycle detection) |
| `/api/tasks/[id]/blockers/[blockingTaskId]` | **DELETE** | **Remove specific blocker edge** |
| `/api/tasks/[id]/timeline` | GET | Full immutable event log |
| `/api/tasks/[id]/time` | GET, POST | List entries / start timer |
| `/api/tasks/[id]/time/[entryId]` | PATCH, DELETE | Stop timer / delete entry |
| `/api/alerts` | GET | Overdue tasks assigned to me |
| `/api/alerts/[taskId]/dismiss` | POST | Dismiss one alert |
| `/api/dashboard` | GET | Aggregate numbers + chart data |
| `/api/activity` | GET | Cross-project event feed |
| `/api/digest` | GET | Weekly email digest data |
| `/api/saved-filters` | GET, POST | Named filter views |
| `/api/saved-filters/[id]` | DELETE | Remove a saved view |
| `/api/users` | GET | All users (for dropdowns) |
| `/api/users/lookup` | GET | Find user by email |
| `/api/users/[id]` | **GET, PATCH** | **Single user profile / manager edit** |
| `/api/users/[id]/promote` | PATCH | Promote MEMBER to MANAGER |
| `/api/health` | **GET** | **DB ping health check (no auth)** |

---

### 3. Database layer (PostgreSQL via Prisma)

A single managed Postgres database (Supabase free tier). Prisma is the only way data reaches the database — there are no raw SQL queries anywhere except an inline comment in `dashboard/route.js` explaining what the SQL equivalent would be for the weekly-bucketing query.

**The Prisma singleton pattern** in `src/lib/prisma.js`:

```js
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

Next.js in development mode hot-reloads modules on file save. Without this pattern, every save would create a new `PrismaClient` instance, which opens a new connection pool. Postgres has a default connection limit of 100; with Supabase free tier it's lower. The singleton ensures that in dev there is at most one client instance per Node.js process, regardless of how many times the module is hot-reloaded.

In production (Vercel serverless), each function invocation gets a fresh module scope anyway — the `globalThis` guard has no effect, and each function manages one connection that closes when the invocation ends.

---

## Where each piece runs

| Piece | Environment | Notes |
|---|---|---|
| React pages (client components) | Browser only | Not server-rendered — `"use client"` at top of each page file |
| Next.js route handlers | Node.js (Vercel serverless) | One function per `route.js` file; cold starts ~200–400ms on Vercel free tier |
| Prisma client | Same Node.js process as the route handler | Never in the browser bundle |
| Postgres database | Supabase managed cloud (free tier) | Connection string in `DATABASE_URL` env var, never committed |
| Static assets, CSS, fonts | CDN (Vercel Edge Network) | Served from the closest region |

**Environment variables in use** (see `.env.example` for the full list with comments):

| Variable | Used by | Where set |
|---|---|---|
| `DATABASE_URL` | Prisma client | Supabase / Railway connection string |
| `JWT_SECRET` | `src/lib/auth.js` | Random 64-char hex string |
| `NODE_ENV` | Prisma singleton guard, cookie `secure` flag | Set automatically by Vercel/Railway |
| `APP_URL` | Email links in digest | e.g. `https://yourapp.vercel.app` |
| `SMTP_HOST` | `nodemailer` (digest) | SMTP provider hostname |
| `SMTP_PORT` | `nodemailer` (digest) | Usually 587 (STARTTLS) |
| `SMTP_USER` | `nodemailer` (digest) | SMTP account username |
| `SMTP_PASS` | `nodemailer` (digest) | SMTP account password |
| `SMTP_FROM` | `nodemailer` (digest) | From address shown on digest emails |

---

## Request path for one representative action: changing a task's status

This traces every function call, file, and database operation involved when a user clicks "Move to IN_REVIEW" on a task that is currently IN_PROGRESS.

**Step 1 — User clicks the button (browser)**

`changeStatus("IN_REVIEW")` in `src/app/(dashboard)/tasks/[taskId]/page.js` runs:
- `setStatusError("")` — clears any previous error
- `setPendingTarget("IN_REVIEW")` — disables all status buttons to prevent double-clicks
- `setTask(t => ({ ...t, status: "IN_REVIEW" }))` — **optimistic update**: the badge flips immediately in the UI before any network request

**Step 2 — HTTP request leaves the browser**

```
PATCH /api/tasks/{taskId}/status
Cookie: session=<jwt>
Content-Type: application/json
Body: { "targetStatus": "IN_REVIEW" }
```

The `session` cookie is automatically attached by the browser (same-origin, SameSite=lax).

**Step 3 — Route handler begins (`src/app/api/tasks/[taskId]/status/route.js`)**

```
withErrorHandling(handler) → calls handler(req, { params })
```

Inside the handler:
1. `requireAuth()` — reads `cookies().get("session").value`, calls `jwt.verify(token, JWT_SECRET)`, returns `{ userId, role }`. Throws `HttpError(401)` if missing or expired.
2. `prisma.task.findUnique({ where: { id: taskId } })` — loads the current task. Throws `HttpError(404)` if not found.
3. `requireProjectAccess(session, task.projectId)` — for MEMBER role, queries `ProjectMember` for `[projectId, userId]`. Throws `HttpError(403)` if not a member. Managers pass immediately.
4. `statusChangeSchema.safeParse(body)` — Zod validates `{ targetStatus: "IN_REVIEW" }`. Throws `HttpError(400)` if `targetStatus` is not one of the valid enum values.
5. `validateTransition(task.status, "IN_REVIEW", hasIncompleteBlockers, task.blockedFromStatus)` from `src/lib/taskStateMachine.js` — checks the transition against the state machine rules. Returns `{ ok: false, reason: "..." }` for illegal moves (thrown as `HttpError(422, reason)`).
6. `prisma.task.update({ where: { id: taskId }, data: { status: "IN_REVIEW" } })` — writes the new status to Postgres.
7. `writeTaskEvent({ taskId, userId, type: "STATUS_CHANGE", oldValue: "IN_PROGRESS", newValue: "IN_REVIEW" })` from `src/lib/auditLog.js` — inserts an immutable row into `TaskEvent`.

**Step 4 — Response**

```
200 OK
Content-Type: application/json
Body: { updated task object }
```

**Step 5 — Browser handles the response**

On success: `loadTask()` and `loadTimeline()` are called in parallel (`Promise.all`) to get the authoritative server state. The optimistic update is confirmed.

On failure (e.g. 422 because a blocker was completed in another tab after the page loaded): `setTask(t => ({ ...t, status: "IN_PROGRESS" }))` rolls back the optimistic update. `setStatusError(d.error)` shows the rejection reason below the status buttons.

**Total database queries for this action:** 3 (load task, check membership if MEMBER, update task) + 1 insert for the audit event = **4 queries**.

---

## Second representative path: loading the All Tasks page with filters

When a user visits `/tasks` and sets status = "IN_PROGRESS" and assigns a search term "design", this is what happens:

**Browser → API:**
```
GET /api/tasks?search=design&status=IN_PROGRESS&sortBy=updatedAt&sortDir=desc&page=1&pageSize=20
```

**In the route handler (`src/app/api/tasks/route.js`):**

1. Auth and session as above.
2. Build the Prisma `where` clause dynamically — each query param is only added if present:
   ```js
   where = {
     projectId: { in: visibleProjectIds },  // scoping by role
     status: "IN_PROGRESS",
     OR: [
       { title: { contains: "design", mode: "insensitive" } },
       { description: { contains: "design", mode: "insensitive" } }
     ]
   }
   ```
3. `Promise.all([prisma.task.count({ where }), prisma.task.findMany({ where, skip: 0, take: 20, orderBy: { updatedAt: "desc" }, include: { ... } })])` — two queries run in parallel.
4. Return `{ tasks: [...], pagination: { page: 1, total: N, totalPages: M } }`.

**On the client:** `requestIdRef.current` is incremented before the fetch. Only the `.then()` whose `thisRequestId === requestIdRef.current` calls `setTasks()`. This discards stale responses from previous keystrokes.

---

## What was deliberately not built, and why

**Refresh token rotation** — The JWT expires in 7 days with no refresh mechanism. Production would issue a 15-minute access token and a 7-day refresh token. Not built because the brief's threat model (internal team tool, known users) does not require sub-day token revocation, and adding it would need a `RefreshToken` table and two extra route handlers.

**Real-time updates** — Changes made by one user are not pushed to another user's browser; they must refresh to see them. Implementing this would require WebSockets or Server-Sent Events. Next.js serverless functions cannot hold long-lived connections. A real-time layer would require a separate infrastructure piece (Ably, Pusher, or Supabase Realtime). Not worth the complexity for the required goals.

---

## Production-grade additions (post-assessment)

The following pieces were added after the assessment goals were met, to bring the project closer to real-world deployability. Each one is documented in full in `docs/decisions.md` Appendix A1–A12.

| Addition | Files changed | What it solves |
|---|---|---|
| Edge auth guard | `middleware.js` | Dashboard pages had no server-side protection — cookie check now runs before any render |
| Rate limiting | `src/lib/rateLimit.js`, `api/auth/login` | Login was open to brute-force; now capped at 10 attempts per IP per 15 minutes |
| `PATCH /api/auth/me` | `api/auth/me/route.js`, `validators.js` | Users had no way to change their own name or password |
| `GET /api/tasks/[id]/comments` | `api/tasks/[taskId]/comments/route.js` | Comments were write-only — POST existed, GET did not |
| Blockers API | `api/tasks/[taskId]/blockers/route.js` + `[blockingTaskId]/route.js` | `TaskBlocker` schema existed but had no standalone API surface |
| `GET+PATCH /api/users/[id]` | `api/users/[userId]/route.js` | No single-user profile endpoint; managers had no way to edit user name/email |
| `GET /api/health` | `api/health/route.js` | No health check for load balancers or uptime monitors |
| Error + 404 pages | `src/app/error.js`, `src/app/not-found.js` | Runtime crashes and bad URLs showed raw Next.js screens |
| Loading skeletons | `src/app/loading.js` + route-level `loading.js` files | `Skeleton.js` component existed but no route used it — blank flash on navigation |
| `docker-compose.yml` | `docker-compose.yml` | No local DB setup path; developers had to install Postgres manually |
| CI workflow | `.github/workflows/ci.yml` | Tests only ran manually; broken code could be merged with no checks |
| `.env.example` expanded | `.env.example` | `SMTP_*` vars for nodemailer were completely undocumented |
