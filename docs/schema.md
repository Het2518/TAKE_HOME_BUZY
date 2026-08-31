# Schema

## Tables, columns, and types

### User
| Column | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key, auto-generated |
| email | String | Unique — login identity |
| passwordHash | String | bcrypt, cost factor 10 — never returned by any API |
| name | String | Display name |
| role | Enum: MANAGER \| MEMBER | Defaults to MEMBER; cannot be set by self-service signup |
| createdAt | DateTime | Set by DB on insert |

### Project
| Column | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key |
| key | String | Unique short code (e.g. "ACME"), used in breadcrumbs |
| name | String | Display name |
| description | String | Defaults to empty string (not nullable) |
| archived | Boolean | Default false; archived projects are hidden but not deleted |
| ownerId | String | FK → User.id |
| createdAt, updatedAt | DateTime | updatedAt managed by Prisma `@updatedAt` |

### ProjectMember (join table)
| Column | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key |
| projectId | String | FK → Project.id (cascade delete) |
| userId | String | FK → User.id (cascade delete) |
| createdAt | DateTime | |
| _(unique)_ | — | `[projectId, userId]` — prevents duplicate membership rows |

### Task
| Column | Type | Notes |
|---|---|---|
| id | String (cuid) | Primary key |
| projectId | String | FK → Project.id (cascade delete) |
| title | String | |
| description | String | Defaults to empty string |
| priority | Enum: LOW \| MEDIUM \| HIGH \| URGENT | Defaults to MEDIUM |
| status | Enum: BACKLOG \| IN_PROGRESS \| IN_REVIEW \| DONE \| BLOCKED | Defaults to BACKLOG |
| dueDate | DateTime? | Optional |
| dueDateUpdatedAt | DateTime? | Written any time dueDate changes; compared against AlertDismissal.dismissedAt to decide whether a dismissed alert should reappear (goal 10 requirement) |
| blockedFromStatus | TaskStatus? | When a task enters BLOCKED, the status it came from is stored here so unblocking can return it to the right state |
| createdAt, updatedAt | DateTime | |

**Indexes:**
- `[projectId, status]` — supports the project-detail task list and bulk status queries
- `[dueDate]` — supports the overdue alerts query and dashboard "due this week" count

### TaskBlocker (join table for self-referential many-to-many)
| Column | Type | Notes |
|---|---|---|
| id | String (cuid) | |
| taskId | String | The task that is blocked — FK → Task.id (cascade delete) |
| blockingTaskId | String | The task that must finish first — FK → Task.id (cascade delete) |
| _(unique)_ | — | `[taskId, blockingTaskId]` — prevents duplicate edges |

### TaskAssignee (join table)
| Column | Type | Notes |
|---|---|---|
| id | String (cuid) | |
| taskId | String | FK → Task.id (cascade delete) |
| userId | String | FK → User.id (cascade delete) |
| createdAt | DateTime | |
| _(unique)_ | — | `[taskId, userId]` |

### TaskEvent (immutable audit log)
| Column | Type | Notes |
|---|---|---|
| id | String (cuid) | |
| taskId | String | FK → Task.id (cascade delete) |
| userId | String | FK → User.id (no cascade — user records are not deleted) |
| type | Enum: CREATED \| FIELD_CHANGE \| ASSIGNED \| UNASSIGNED \| COMMENT \| STATUS_CHANGE | |
| field | String? | Which field changed (for FIELD_CHANGE events) |
| oldValue | String? | Previous value, stringified |
| newValue | String? | New value, stringified |
| commentText | String? | Set only for COMMENT events |
| createdAt | DateTime | |

**Index:** `[taskId, createdAt]` — the timeline query always filters by taskId and orders by time.

### SavedFilter (stretch goal)
| Column | Type | Notes |
|---|---|---|
| id | String (cuid) | |
| userId | String | FK → User.id (cascade delete) |
| name | String | User-chosen label |
| filterJson | String | JSON-serialized filter state — mirrors the exact query-param shape `GET /api/tasks` accepts |
| createdAt | DateTime | |
| _(unique)_ | — | `[userId, name]` — one named filter per user |

### AlertDismissal
| Column | Type | Notes |
|---|---|---|
| id | String (cuid) | |
| taskId | String | FK → Task.id (cascade delete) |
| userId | String | FK → User.id (cascade delete) |
| dismissedAt | DateTime | Set to now() on create and on re-dismiss |
| _(unique)_ | — | `[taskId, userId]` — one dismissal record per (task, user) pair |

---

## Relationships

| Relationship | Type | How realized |
|---|---|---|
| User → ownedProjects | 1-to-many | `Project.ownerId` FK |
| Project ↔ User (membership) | many-to-many | `ProjectMember` join table |
| Project → Task | 1-to-many | `Task.projectId` FK |
| Task ↔ Task (blocking) | many-to-many, self-referential | `TaskBlocker` join table |
| Task ↔ User (assignment) | many-to-many | `TaskAssignee` join table |
| Task → TaskEvent | 1-to-many | `TaskEvent.taskId` FK |
| Task → AlertDismissal | 1-to-many | `AlertDismissal.taskId` FK |
| User → SavedFilter | 1-to-many | `SavedFilter.userId` FK |

---

## Constraints: database vs. application code

**Enforced in the database:**
- Unique email (`User.email`)
- Unique project key (`Project.key`)
- Unique membership (`ProjectMember[projectId, userId]`)
- Unique assignment (`TaskAssignee[taskId, userId]`)
- Unique blocker edge (`TaskBlocker[taskId, blockingTaskId]`)
- Unique dismissal (`AlertDismissal[taskId, userId]`)
- Cascade deletes on all FK relationships to project/task — removing a project removes its tasks, events, assignments, blockers atomically

**Enforced in application code (why the line was drawn here):**
- **Role-based access** — the DB has no concept of a session; `requireRole` and `requireProjectAccess` live in `src/lib/permissions.js` and run in every route handler.
- **Task state machine transitions** — which status can follow which is a business rule, not a DB constraint. Enforcing it in `src/lib/taskStateMachine.js` (called from the API) means the rule can be tested in isolation without a DB and can be reused client-side to show only legal moves.
- **Only-assigned-users can dismiss alerts** — checked in the dismiss route against `TaskAssignee`.
- **Blockers must be in the same project** — a cross-project FK would be valid to the DB; the same-project check is a domain rule enforced in the task create/update handlers.
- **Cycle detection** — entirely application-side DFS in `wouldCreateCycle()`; SQL has no built-in cycle guard for self-referential many-to-many.

---

## What was deliberately denormalised

`Task.dueDateUpdatedAt` is the one deliberate denormalisation. When a due date changes, this column is stamped with `now()`. The alert-reappear logic compares `dueDateUpdatedAt > dismissal.dismissedAt` — which would otherwise require either joining to `TaskEvent` and finding the latest FIELD_CHANGE on `dueDate`, or scanning event history. Storing the timestamp directly on the task makes the alert query a single indexed comparison.

`SavedFilter.filterJson` stores the filter state as a serialised JSON string on a single column rather than as individual columns for each filter field. The schema for filters is deliberately not normalised because it mirrors the query-params shape of `GET /api/tasks` — applying a saved filter is just spreading the parsed JSON into the URL params, with no extra mapping logic. If the filter shape changes, the stored JSON becomes stale, but that is an acceptable trade-off at this data scale.

---

## What would break first at 100x the data

**Dashboard completions-by-week** (`GET /api/dashboard`): the current implementation fetches all DONE tasks updated in the last 8 weeks and buckets them in JavaScript. At 100x scale, this could be fetching tens of thousands of rows. The fix is a `date_trunc('week', "updatedAt")` GROUP BY query pushed to the database (noted in a comment in `src/app/api/dashboard/route.js`).

**Activity feed** (`GET /api/activity`): paginates `TaskEvent` across all visible projects at 30 per page. `TaskEvent` will be the largest table by far (one row per field change, not per task). The existing `[taskId, createdAt]` index does not help a cross-project query ordered by `createdAt DESC`. A covering index on `(createdAt DESC)` would be needed, or an event-fan-out write model.

**User list** (`GET /api/users`): currently returns every user on every request that needs a dropdown. At 100x user count, this needs pagination or a typeahead/autocomplete pattern backed by a search query.
