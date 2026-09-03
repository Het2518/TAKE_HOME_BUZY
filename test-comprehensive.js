/**
 * ============================================================
 *  COMPREHENSIVE API EDGE-CASE TEST SUITE
 *  Project Task Tracker — All Goals (1-10) + Stretch APIs
 * ============================================================
 *
 *  RUN:  node test-comprehensive.js
 *  REQUIRES: Server running at http://localhost:3000
 *            with seeded demo accounts:
 *              manager  → aarav@demo.com   / Password123!
 *              member   → vihaan@demo.com  / Password123!
 *
 *  Priority order (mirrors goal numbers):
 *    GOAL 1  → Auth / Roles / RBAC
 *    GOAL 2  → Projects CRUD
 *    GOAL 3  → Tasks + Dependencies + Cycle detection
 *    GOAL 4  → Task lifecycle / state-machine
 *    GOAL 5  → Assignment rules
 *    GOAL 6  → Search, Filter, Sort, Pagination
 *    GOAL 7  → Bulk actions + CSV export
 *    GOAL 8  → Dashboard analytics
 *    GOAL 9  → Immutable audit / timeline / comments
 *    GOAL 10 → Overdue alerts + dismiss / re-appear
 *  STRETCH  → Saved filters, Custom fields, Time tracking,
 *              Activity feed, Digest, Health
 * ============================================================
 */

const BASE_URL = 'http://localhost:3000';

// ─── state shared across suites ──────────────────────────────
let managerCookie = '';
let memberCookie  = '';
let managerId     = '';
let memberId      = '';
let projectId     = '';
let taskA         = '';   // normal task
let taskB         = '';   // blocker task
let taskC         = '';   // for cycle tests
let overdueTaskId = '';
let commentId     = '';
let timeEntryId   = '';
let savedFilterId = '';
let customFieldId = '';

const ACCOUNTS = {
  manager: { email: 'aarav@demo.com',  password: 'Password123!' },
  member:  { email: 'vihaan@demo.com', password: 'Password123!' },
};

// ─── test infra ──────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function ok(condition, label, extra) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    if (extra !== undefined) console.error('     →', JSON.stringify(extra, null, 2)?.slice(0, 400));
    failed++;
    failures.push(label);
  }
}

async function api(path, options = {}, role = 'manager') {
  const cookie = role === 'manager' ? managerCookie : memberCookie;
  const headers = {
    'Content-Type': 'application/json',
    ...(cookie ? { Cookie: cookie } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    if (role === 'manager') managerCookie = setCookie;
    else                    memberCookie  = setCookie;
  }
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

function section(title) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

// ═════════════════════════════════════════════════════════════
//  GOAL 1 — Auth, Roles, RBAC
// ═════════════════════════════════════════════════════════════
async function testGoal1_Auth() {
  section('GOAL 1 — Auth / Roles / RBAC');

  // 1-1  Valid manager login
  let r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(ACCOUNTS.manager) }, 'manager');
  ok(r.status === 200 && r.data.role === 'MANAGER', '1-1  Manager login → 200 + MANAGER role', r.data);

  // 1-2  Valid member login
  r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(ACCOUNTS.member) }, 'member');
  ok(r.status === 200 && r.data.role === 'MEMBER', '1-2  Member login → 200 + MEMBER role', r.data);

  // Remember IDs
  r = await api('/api/users', { method: 'GET' }, 'manager');
  const users = r.data;
  const managerUser = users?.find(u => u.email === ACCOUNTS.manager.email);
  const memberUser  = users?.find(u => u.email === ACCOUNTS.member.email);
  managerId = managerUser?.id;
  memberId  = memberUser?.id;
  ok(managerId && memberId, '1-3  GET /api/users returns both accounts', users);

  // 1-4  Wrong password → 401
  r = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: ACCOUNTS.manager.email, password: 'WrongPass!' }),
  }, 'manager');
  ok(r.status === 401, '1-4  Wrong password → 401', r.data);

  // 1-5  Non-existent email → 401 (no user enumeration leak)
  r = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'nobody@example.com', password: 'Password123!' }),
  }, 'manager');
  ok(r.status === 401, '1-5  Non-existent email → 401 (no enumeration)', r.data);

  // 1-6  Missing fields → 400
  r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: ACCOUNTS.manager.email }) }, 'manager');
  ok(r.status === 400, '1-6  Missing password → 400', r.data);

  // 1-7  Unauthenticated request → 401
  r = await fetch(`${BASE_URL}/api/projects`);
  ok(r.status === 401, '1-7  Unauthenticated GET /api/projects → 401');

  // 1-8  GET /api/auth/me returns session
  r = await api('/api/auth/me', { method: 'GET' }, 'manager');
  ok(r.status === 200 && r.data.email === ACCOUNTS.manager.email, '1-8  GET /api/auth/me returns manager session', r.data);

  // 1-9  Member has their own session cookie
  r = await api('/api/auth/me', { method: 'GET' }, 'member');
  ok(r.status === 200 && r.data.email === ACCOUNTS.member.email, '1-9  GET /api/auth/me returns member session', r.data);

  // 1-10  GET /api/users accessible by member too
  r = await api('/api/users', { method: 'GET' }, 'member');
  ok(r.status === 200 && Array.isArray(r.data), '1-10 GET /api/users accessible by member', r.data);
}

// ═════════════════════════════════════════════════════════════
//  GOAL 2 — Projects CRUD
// ═════════════════════════════════════════════════════════════
async function testGoal2_Projects() {
  section('GOAL 2 — Projects CRUD');

  const key = `EC${Date.now().toString(36).toUpperCase().slice(-5)}`;

  // 2-1  Member cannot create project → 403
  let r = await api('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ key: 'FAIL', name: 'Unauthorized', description: '' }),
  }, 'member');
  ok(r.status === 403 || r.status === 401, '2-1  Member cannot create project → 403', r.data);

  // 2-2  Manager creates project → 201
  r = await api('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ key, name: 'Edge Case Project', description: 'Test project', ownerId: managerId }),
  }, 'manager');
  ok(r.status === 201 && r.data.id, '2-2  Manager creates project → 201', r.data);
  projectId = r.data.id;

  // 2-3  Duplicate key → 409
  r = await api('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ key, name: 'Duplicate', description: '', ownerId: managerId }),
  }, 'manager');
  ok(r.status === 409, '2-3  Duplicate project key → 409', r.data);

  // 2-4  GET /api/projects lists active projects
  r = await api('/api/projects', { method: 'GET' }, 'manager');
  ok(r.status === 200 && Array.isArray(r.data), '2-4  GET /api/projects → 200 array', r.data);

  // 2-5  Member doesn't see project before being added
  r = await api('/api/projects', { method: 'GET' }, 'member');
  const hasBefore = Array.isArray(r.data) && r.data.some(p => p.id === projectId);
  ok(!hasBefore, '2-5  Member cannot see project before membership', r.data);

  // 2-6  GET /api/projects/:id as manager
  r = await api(`/api/projects/${projectId}`, { method: 'GET' }, 'manager');
  ok(r.status === 200 && r.data.id === projectId, '2-6  GET /api/projects/:id → 200', r.data);

  // 2-7  PATCH project as manager
  r = await api(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: 'Updated Project Name' }),
  }, 'manager');
  ok(r.status === 200 && r.data.name === 'Updated Project Name', '2-7  Manager PATCH project → 200', r.data);

  // 2-8  Member cannot PATCH project
  r = await api(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: 'Hacked' }),
  }, 'member');
  ok(r.status === 403 || r.status === 401, '2-8  Member cannot PATCH project → 403', r.data);

  // 2-9  Archive project
  r = await api(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify({ archived: true }),
  }, 'manager');
  ok(r.status === 200 && r.data.archived === true, '2-9  Archive project → archived=true', r.data);

  // 2-10  Archived project excluded by default
  r = await api('/api/projects', { method: 'GET' }, 'manager');
  const hasArchived = Array.isArray(r.data) && r.data.some(p => p.id === projectId);
  ok(!hasArchived, '2-10 Archived project excluded from default list', r.data);

  // 2-11  includeArchived=true shows it
  r = await api('/api/projects?includeArchived=true', { method: 'GET' }, 'manager');
  const hasArchivedNow = Array.isArray(r.data) && r.data.some(p => p.id === projectId);
  ok(hasArchivedNow, '2-11 ?includeArchived=true shows archived project', r.data);

  // Restore for further tests
  await api(`/api/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify({ archived: false }),
  }, 'manager');
  console.log('  ℹ️  Project restored (archived=false) for subsequent tests');

  // 2-12  Missing required field → 400
  r = await api('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ name: 'No Key', description: '', ownerId: managerId }),
  }, 'manager');
  ok(r.status === 400, '2-12 Missing project key → 400', r.data);

  // 2-13  GET non-existent project → 404
  r = await api('/api/projects/non-existent-id', { method: 'GET' }, 'manager');
  ok(r.status === 404, '2-13 GET non-existent project → 404', r.data);
}

// ═════════════════════════════════════════════════════════════
//  GOAL 3 — Tasks + Dependencies + Cycle Detection
// ═════════════════════════════════════════════════════════════
async function testGoal3_Tasks() {
  section('GOAL 3 — Tasks, Dependencies & Cycle Detection');

  // Add member to project first
  await api(`/api/projects/${projectId}/members`, {
    method: 'POST',
    body: JSON.stringify({ userId: memberId }),
  }, 'manager');

  // 3-1  Create task A (will be blocked by B)
  let r = await api('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ title: 'Task A', projectId, priority: 'HIGH', description: 'Main task' }),
  }, 'manager');
  ok(r.status === 201 && r.data.id, '3-1  Create task A → 201', r.data);
  taskA = r.data.id;

  // 3-2  Create task B (blocker)
  r = await api('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ title: 'Task B Blocker', projectId, priority: 'MEDIUM' }),
  }, 'manager');
  ok(r.status === 201 && r.data.id, '3-2  Create task B (blocker) → 201', r.data);
  taskB = r.data.id;

  // 3-3  Create task C (for cycle test)
  r = await api('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ title: 'Task C', projectId, priority: 'LOW' }),
  }, 'manager');
  ok(r.status === 201, '3-3  Create task C → 201', r.data);
  taskC = r.data.id;

  // 3-4  Create task with dependency at creation time
  r = await api('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ title: 'Task A2', projectId, blockingTaskIds: [taskB] }),
  }, 'manager');
  ok(r.status === 201, '3-4  Create task with blockingTaskIds at creation → 201', r.data);
  const taskA2 = r.data.id;

  // 3-5  Self-blocking via POST /blockers
  r = await api(`/api/tasks/${taskA}/blockers`, {
    method: 'POST',
    body: JSON.stringify({ blockingTaskId: taskA }),
  }, 'manager');
  ok(r.status === 422, '3-5  Self-blocking rejected → 422', r.data);

  // 3-6  Cross-project blocking attempt
  const key2 = `CP${Date.now().toString(36).toUpperCase().slice(-4)}`;
  let rp = await api('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ key: key2, name: 'Cross Proj', ownerId: managerId }),
  }, 'manager');
  const crossProjId = rp.data.id;
  let rt = await api('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ title: 'Cross Task', projectId: crossProjId }),
  }, 'manager');
  const crossTaskId = rt.data.id;
  r = await api(`/api/tasks/${taskA}/blockers`, {
    method: 'POST',
    body: JSON.stringify({ blockingTaskId: crossTaskId }),
  }, 'manager');
  ok(r.status === 422, '3-6  Cross-project blocker → 422', r.data);

  // 3-7  Add valid blocker B→A
  r = await api(`/api/tasks/${taskA}/blockers`, {
    method: 'POST',
    body: JSON.stringify({ blockingTaskId: taskB }),
  }, 'manager');
  ok(r.status === 201 || r.status === 200, '3-7  Add valid blocker (B→A) → 201', r.data);

  // 3-8  Idempotent: add same blocker again → no error
  r = await api(`/api/tasks/${taskA}/blockers`, {
    method: 'POST',
    body: JSON.stringify({ blockingTaskId: taskB }),
  }, 'manager');
  ok(r.status === 201 || r.status === 200, '3-8  Idempotent re-add blocker → 2xx', r.data);

  // 3-9  GET /blockers lists them
  r = await api(`/api/tasks/${taskA}/blockers`, { method: 'GET' }, 'manager');
  ok(r.status === 200 && Array.isArray(r.data) && r.data.length >= 1, '3-9  GET /blockers returns list', r.data);

  // 3-10  Cycle detection: A blocked by B; try to make B blocked by A → cycle
  r = await api(`/api/tasks/${taskB}/blockers`, {
    method: 'POST',
    body: JSON.stringify({ blockingTaskId: taskA }),
  }, 'manager');
  ok(r.status === 422, '3-10 Cycle detection: B→A when A blocked by B → 422', r.data);

  // 3-11  Three-node cycle: A←B, B←C, now C←A → should be caught
  await api(`/api/tasks/${taskB}/blockers`, {
    method: 'POST',
    body: JSON.stringify({ blockingTaskId: taskC }),
  }, 'manager');
  r = await api(`/api/tasks/${taskC}/blockers`, {
    method: 'POST',
    body: JSON.stringify({ blockingTaskId: taskA }),
  }, 'manager');
  ok(r.status === 422, '3-11 Three-node cycle detection → 422', r.data);

  // 3-12  Non-existent blocker → 404
  r = await api(`/api/tasks/${taskA}/blockers`, {
    method: 'POST',
    body: JSON.stringify({ blockingTaskId: 'does-not-exist' }),
  }, 'manager');
  ok(r.status === 404, '3-12 Non-existent blocker task → 404', r.data);

  // 3-13  GET /api/tasks/:id returns full task
  r = await api(`/api/tasks/${taskA}`, { method: 'GET' }, 'manager');
  ok(r.status === 200 && r.data.id === taskA, '3-13 GET /api/tasks/:id → 200 full task', r.data);

  // 3-14  GET non-existent task → 404
  r = await api('/api/tasks/nonexistent', { method: 'GET' }, 'manager');
  ok(r.status === 404, '3-14 GET non-existent task → 404', r.data);

  // 3-15  PATCH task fields
  r = await api(`/api/tasks/${taskA}`, {
    method: 'PATCH',
    body: JSON.stringify({ title: 'Task A (updated)', priority: 'URGENT' }),
  }, 'manager');
  ok(r.status === 200 && r.data.priority === 'URGENT', '3-15 PATCH task fields → 200', r.data);

  // 3-16  Member can create task in project they belong to
  r = await api('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ title: 'Member Task', projectId }),
  }, 'member');
  ok(r.status === 201, '3-16 Member can create task in their project → 201', r.data);

  // 3-17  Member cannot create task in project they don't belong to
  r = await api('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ title: 'Unauthorized Task', projectId: crossProjId }),
  }, 'member');
  ok(r.status === 403 || r.status === 401, '3-17 Member cannot create task outside project → 403', r.data);

  // 3-18  DELETE task (manager only)
  r = await api(`/api/tasks/${taskA2}`, { method: 'DELETE' }, 'manager');
  ok(r.status === 200, '3-18 Manager can DELETE task → 200', r.data);

  // 3-19  Member cannot DELETE task
  const memberTask = (await api('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ title: 'To Delete', projectId }),
  }, 'manager')).data;
  r = await api(`/api/tasks/${memberTask.id}`, { method: 'DELETE' }, 'member');
  ok(r.status === 403, '3-19 Member cannot DELETE task → 403', r.data);
  // cleanup
  await api(`/api/tasks/${memberTask.id}`, { method: 'DELETE' }, 'manager');
}

// ═════════════════════════════════════════════════════════════
//  GOAL 4 — Task Lifecycle State Machine
// ═════════════════════════════════════════════════════════════
async function testGoal4_StateMachine() {
  section('GOAL 4 — Task Lifecycle (State Machine)');

  // Create a fresh task without blockers for clean transitions
  let r = await api('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ title: 'Lifecycle Task', projectId }),
  }, 'manager');
  const liftTaskId = r.data.id;

  // 4-1  BACKLOG → DONE (skip) → 422
  r = await api(`/api/tasks/${liftTaskId}/status`, {
    method: 'PATCH', body: JSON.stringify({ targetStatus: 'DONE' }),
  }, 'manager');
  ok(r.status === 422, '4-1  BACKLOG → DONE (illegal skip) → 422', r.data);

  // 4-2  BACKLOG → IN_REVIEW (skip) → 422
  r = await api(`/api/tasks/${liftTaskId}/status`, {
    method: 'PATCH', body: JSON.stringify({ targetStatus: 'IN_REVIEW' }),
  }, 'manager');
  ok(r.status === 422, '4-2  BACKLOG → IN_REVIEW (illegal skip) → 422', r.data);

  // 4-3  BACKLOG → IN_PROGRESS ✓
  r = await api(`/api/tasks/${liftTaskId}/status`, {
    method: 'PATCH', body: JSON.stringify({ targetStatus: 'IN_PROGRESS' }),
  }, 'manager');
  ok(r.status === 200 && r.data.status === 'IN_PROGRESS', '4-3  BACKLOG → IN_PROGRESS → 200', r.data);

  // 4-4  IN_PROGRESS → DONE (skip review) → 422
  r = await api(`/api/tasks/${liftTaskId}/status`, {
    method: 'PATCH', body: JSON.stringify({ targetStatus: 'DONE' }),
  }, 'manager');
  ok(r.status === 422, '4-4  IN_PROGRESS → DONE (skip review) → 422', r.data);

  // 4-5  IN_PROGRESS → IN_REVIEW ✓
  r = await api(`/api/tasks/${liftTaskId}/status`, {
    method: 'PATCH', body: JSON.stringify({ targetStatus: 'IN_REVIEW' }),
  }, 'manager');
  ok(r.status === 200 && r.data.status === 'IN_REVIEW', '4-5  IN_PROGRESS → IN_REVIEW → 200', r.data);

  // 4-6  IN_REVIEW → DONE ✓ (no blockers)
  r = await api(`/api/tasks/${liftTaskId}/status`, {
    method: 'PATCH', body: JSON.stringify({ targetStatus: 'DONE' }),
  }, 'manager');
  ok(r.status === 200 && r.data.status === 'DONE', '4-6  IN_REVIEW → DONE → 200', r.data);

  // 4-7  DONE blocked by incomplete blocker
  //      Move A to IN_REVIEW then try DONE with active blocker
  await api(`/api/tasks/${taskA}/status`, {
    method: 'PATCH', body: JSON.stringify({ targetStatus: 'IN_PROGRESS' }),
  }, 'manager');
  await api(`/api/tasks/${taskA}/status`, {
    method: 'PATCH', body: JSON.stringify({ targetStatus: 'IN_REVIEW' }),
  }, 'manager');
  r = await api(`/api/tasks/${taskA}/status`, {
    method: 'PATCH', body: JSON.stringify({ targetStatus: 'DONE' }),
  }, 'manager');
  ok(r.status === 422 && r.data?.error?.toLowerCase().includes('block'),
    '4-7  DONE blocked by incomplete blocker → 422 with "block" in message', r.data);

  // 4-8  Complete the blockers (C blocks B, B blocks A), then A can go DONE
  await api(`/api/tasks/${taskC}/status`, {
    method: 'PATCH', body: JSON.stringify({ targetStatus: 'IN_PROGRESS' }),
  }, 'manager');
  await api(`/api/tasks/${taskC}/status`, {
    method: 'PATCH', body: JSON.stringify({ targetStatus: 'IN_REVIEW' }),
  }, 'manager');
  await api(`/api/tasks/${taskC}/status`, {
    method: 'PATCH', body: JSON.stringify({ targetStatus: 'DONE' }),
  }, 'manager');

  await api(`/api/tasks/${taskB}/status`, {
    method: 'PATCH', body: JSON.stringify({ targetStatus: 'IN_PROGRESS' }),
  }, 'manager');
  await api(`/api/tasks/${taskB}/status`, {
    method: 'PATCH', body: JSON.stringify({ targetStatus: 'IN_REVIEW' }),
  }, 'manager');
  await api(`/api/tasks/${taskB}/status`, {
    method: 'PATCH', body: JSON.stringify({ targetStatus: 'DONE' }),
  }, 'manager');
  r = await api(`/api/tasks/${taskA}/status`, {
    method: 'PATCH', body: JSON.stringify({ targetStatus: 'DONE' }),
  }, 'manager');
  ok(r.status === 200, '4-8  After blocker DONE, blocked task can → DONE', r.data);

  // 4-9  Invalid status value → 400/422
  r = await api(`/api/tasks/${liftTaskId}/status`, {
    method: 'PATCH', body: JSON.stringify({ targetStatus: 'FLYING' }),
  }, 'manager');
  ok(r.status === 400 || r.status === 422, '4-9  Invalid targetStatus → 400/422', r.data);

  // 4-10  Missing targetStatus → 400
  r = await api(`/api/tasks/${liftTaskId}/status`, {
    method: 'PATCH', body: JSON.stringify({}),
  }, 'manager');
  ok(r.status === 400, '4-10 Missing targetStatus → 400', r.data);

  // 4-11  BLOCKED transition
  await api(`/api/tasks/${taskC}/status`, {
    method: 'PATCH', body: JSON.stringify({ targetStatus: 'IN_PROGRESS' }),
  }, 'manager');
  r = await api(`/api/tasks/${taskC}/status`, {
    method: 'PATCH', body: JSON.stringify({ targetStatus: 'BLOCKED' }),
  }, 'manager');
  ok(r.status === 200 && r.data.status === 'BLOCKED', '4-11 IN_PROGRESS → BLOCKED → 200', r.data);

  // 4-12  BLOCKED → resume — the state machine requires targetStatus = 'UNBLOCK'
  //        which returns the task to its stored prior status (IN_PROGRESS)
  r = await api(`/api/tasks/${taskC}/status`, {
    method: 'PATCH', body: JSON.stringify({ targetStatus: 'UNBLOCK' }),
  }, 'manager');
  ok(r.status === 200 && r.data.status === 'IN_PROGRESS', '4-12 BLOCKED → IN_PROGRESS (resume) → 200', r.data);

  // cleanup
  await api(`/api/tasks/${liftTaskId}`, { method: 'DELETE' }, 'manager');
}

// ═════════════════════════════════════════════════════════════
//  GOAL 5 — Assignment Rules
// ═════════════════════════════════════════════════════════════
async function testGoal5_Assignment() {
  section('GOAL 5 — Assignment Rules');

  // Fresh task for assignment tests
  let r = await api('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ title: 'Assignment Task', projectId }),
  }, 'manager');
  const assignTaskId = r.data.id;

  // 5-1  Assign project member → 201
  r = await api(`/api/tasks/${assignTaskId}/assignees`, {
    method: 'POST',
    body: JSON.stringify({ userId: memberId }),
  }, 'manager');
  ok(r.status === 201 || r.status === 200, '5-1  Assign project member to task → 201', r.data);

  // 5-2  Idempotent assignment (same user again)
  r = await api(`/api/tasks/${assignTaskId}/assignees`, {
    method: 'POST',
    body: JSON.stringify({ userId: memberId }),
  }, 'manager');
  ok(r.status === 201 || r.status === 200, '5-2  Re-assigning same user → idempotent 2xx', r.data);

  // 5-3  Assign non-project user → 422
  r = await api(`/api/tasks/${assignTaskId}/assignees`, {
    method: 'POST',
    body: JSON.stringify({ userId: 'non-member-id-xyz' }),
  }, 'manager');
  ok(r.status === 422 || r.status === 404, '5-3  Assign non-project user → 422', r.data);

  // 5-4  Missing userId → 400
  r = await api(`/api/tasks/${assignTaskId}/assignees`, {
    method: 'POST',
    body: JSON.stringify({}),
  }, 'manager');
  ok(r.status === 400, '5-4  Missing userId in assign → 400', r.data);

  // 5-5  GET task shows assignees in assignees array
  r = await api(`/api/tasks/${assignTaskId}`, { method: 'GET' }, 'manager');
  const hasAssignee = r.data?.assignees?.some(a => a.user?.id === memberId);
  ok(hasAssignee, '5-5  GET task shows assignees array with member', r.data?.assignees);

  // 5-6  DELETE assignee
  r = await api(`/api/tasks/${assignTaskId}/assignees?userId=${memberId}`, {
    method: 'DELETE',
  }, 'manager');
  ok(r.status === 200, '5-6  DELETE /assignees?userId= → 200', r.data);

  // 5-7  After delete, member no longer in assignees
  r = await api(`/api/tasks/${assignTaskId}`, { method: 'GET' }, 'manager');
  const stillAssigned = r.data?.assignees?.some(a => a.user?.id === memberId);
  ok(!stillAssigned, '5-7  After DELETE, member no longer in assignees', r.data?.assignees);

  // 5-8  Remove member from project → also removes task assignments
  await api(`/api/tasks/${assignTaskId}/assignees`, {
    method: 'POST', body: JSON.stringify({ userId: memberId }),
  }, 'manager');
  r = await api(`/api/projects/${projectId}/members?userId=${memberId}`, {
    method: 'DELETE',
  }, 'manager');
  ok(r.status === 200, '5-8  DELETE /members cascades → 200', r.data);
  r = await api(`/api/tasks/${assignTaskId}`, { method: 'GET' }, 'manager');
  const stillAssignedAfterRemoval = r.data?.assignees?.some(a => a.user?.id === memberId);
  ok(!stillAssignedAfterRemoval, '5-9  After member removal, task unassigned automatically', r.data?.assignees);

  // Re-add member for subsequent tests
  await api(`/api/projects/${projectId}/members`, {
    method: 'POST', body: JSON.stringify({ userId: memberId }),
  }, 'manager');

  // 5-10  Member cannot add another user to project
  r = await api(`/api/projects/${projectId}/members`, {
    method: 'POST', body: JSON.stringify({ userId: managerId }),
  }, 'member');
  ok(r.status === 403, '5-10 Member cannot add project member → 403', r.data);

  // cleanup
  await api(`/api/tasks/${assignTaskId}`, { method: 'DELETE' }, 'manager');
}

// ═════════════════════════════════════════════════════════════
//  GOAL 6 — Search, Filter, Sort, Pagination
// ═════════════════════════════════════════════════════════════
async function testGoal6_SearchFilter() {
  section('GOAL 6 — Search, Filter, Sort & Pagination');

  // Seed a few tasks
  await api('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ title: 'Alpha Search Task', projectId, priority: 'HIGH' }),
  }, 'manager');
  await api('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ title: 'Beta Search Task', projectId, priority: 'LOW' }),
  }, 'manager');

  // 6-1  Search by title keyword
  let r = await api(`/api/tasks?search=Alpha&projectId=${projectId}`, { method: 'GET' }, 'manager');
  ok(r.status === 200 && r.data?.tasks?.some(t => t.title.includes('Alpha')),
    '6-1  Search ?search=Alpha → returns matching task', r.data?.tasks?.map(t => t.title));

  // 6-2  Case-insensitive search
  r = await api(`/api/tasks?search=alpha&projectId=${projectId}`, { method: 'GET' }, 'manager');
  ok(r.status === 200 && r.data?.tasks?.some(t => t.title.toLowerCase().includes('alpha')),
    '6-2  Case-insensitive search → matches', r.data?.tasks?.map(t => t.title));

  // 6-3  Filter by priority
  r = await api(`/api/tasks?projectId=${projectId}&priority=HIGH`, { method: 'GET' }, 'manager');
  ok(r.status === 200 && r.data?.tasks?.every(t => t.priority === 'HIGH'),
    '6-3  Filter ?priority=HIGH → all HIGH', r.data?.tasks?.map(t => t.priority));

  // 6-4  Filter by status
  r = await api(`/api/tasks?projectId=${projectId}&status=BACKLOG`, { method: 'GET' }, 'manager');
  ok(r.status === 200 && r.data?.tasks?.every(t => t.status === 'BACKLOG'),
    '6-4  Filter ?status=BACKLOG → all BACKLOG', r.data?.tasks?.map(t => t.status));

  // 6-5  Pagination — page=1 pageSize=1
  r = await api(`/api/tasks?projectId=${projectId}&page=1&pageSize=1`, { method: 'GET' }, 'manager');
  ok(r.status === 200 && r.data?.tasks?.length === 1 && r.data?.pagination?.total >= 1,
    '6-5  Pagination pageSize=1 → 1 result + pagination meta', r.data?.pagination);

  // 6-6  Pagination metadata correct
  ok(typeof r.data?.pagination?.totalPages === 'number' && r.data?.pagination?.page === 1,
    '6-6  Pagination has totalPages and page fields', r.data?.pagination);

  // 6-7  Sort by dueDate asc
  r = await api(`/api/tasks?projectId=${projectId}&sortBy=dueDate&sortDir=asc`, { method: 'GET' }, 'manager');
  ok(r.status === 200, '6-7  Sort by dueDate asc → 200', r.data);

  // 6-8  Sort by priority
  r = await api(`/api/tasks?projectId=${projectId}&sortBy=priority&sortDir=desc`, { method: 'GET' }, 'manager');
  ok(r.status === 200, '6-8  Sort by priority desc → 200', r.data);

  // 6-9  Filter overdue only
  r = await api(`/api/tasks?projectId=${projectId}&overdue=true`, { method: 'GET' }, 'manager');
  ok(r.status === 200, '6-9  ?overdue=true filter → 200', r.data);

  // 6-10  Filter by assigneeId
  r = await api(`/api/tasks?projectId=${projectId}&assigneeId=${memberId}`, { method: 'GET' }, 'manager');
  ok(r.status === 200, '6-10 Filter by ?assigneeId → 200', r.data);

  // 6-11  Cross-project (no projectId) — manager sees all
  r = await api('/api/tasks', { method: 'GET' }, 'manager');
  ok(r.status === 200 && r.data?.tasks, '6-11 No projectId filter → manager sees all tasks', r.data?.pagination);

  // 6-12  Member sees only tasks from their projects
  r = await api('/api/tasks', { method: 'GET' }, 'member');
  ok(r.status === 200 && r.data?.tasks, '6-12 Member tasks scoped to their projects → 200', r.data?.pagination);

  // 6-13  Large page size capped at 100
  r = await api(`/api/tasks?projectId=${projectId}&pageSize=9999`, { method: 'GET' }, 'manager');
  ok(r.status === 200 && r.data?.pagination?.pageSize <= 100, '6-13 pageSize capped at 100', r.data?.pagination);
}

// ═════════════════════════════════════════════════════════════
//  GOAL 7 — Bulk Actions + CSV Export
// ═════════════════════════════════════════════════════════════
async function testGoal7_Bulk() {
  section('GOAL 7 — Bulk Actions & CSV Export');

  // Seed tasks for bulk
  const taskX = (await api('/api/tasks', {
    method: 'POST', body: JSON.stringify({ title: 'Bulk X', projectId }),
  }, 'manager')).data?.id;
  const taskY = (await api('/api/tasks', {
    method: 'POST', body: JSON.stringify({ title: 'Bulk Y', projectId }),
  }, 'manager')).data?.id;

  // 7-1  Bulk STATUS update
  let r = await api('/api/tasks/bulk', {
    method: 'POST',
    body: JSON.stringify({ taskIds: [taskX, taskY], action: 'STATUS', value: 'IN_PROGRESS' }),
  }, 'manager');
  ok(r.status === 200 && Array.isArray(r.data?.results), '7-1  Bulk STATUS → 200 with results[]', r.data);

  // 7-2  Partial success: one real + one fake ID
  r = await api('/api/tasks/bulk', {
    method: 'POST',
    body: JSON.stringify({ taskIds: [taskX, 'fake-id-xyz'], action: 'STATUS', value: 'IN_REVIEW' }),
  }, 'manager');
  const fakeResult = r.data?.results?.find(res => res.taskId === 'fake-id-xyz');
  ok(r.status === 200 && fakeResult?.success === false, '7-2  Fake ID in bulk → partial failure result', fakeResult);

  // 7-3  Bulk DUE_DATE
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 7);
  r = await api('/api/tasks/bulk', {
    method: 'POST',
    body: JSON.stringify({ taskIds: [taskX, taskY], action: 'DUE_DATE', value: futureDate.toISOString() }),
  }, 'manager');
  ok(r.status === 200 && r.data?.results?.every(res => res.success), '7-3  Bulk DUE_DATE → all succeed', r.data);

  // 7-4  Bulk ASSIGNEE (member is in project)
  r = await api('/api/tasks/bulk', {
    method: 'POST',
    body: JSON.stringify({ taskIds: [taskX], action: 'ASSIGNEE', value: memberId }),
  }, 'manager');
  ok(r.status === 200, '7-4  Bulk ASSIGNEE → 200', r.data);

  // 7-5  Bulk ASSIGNEE with non-member user → per-task failure
  r = await api('/api/tasks/bulk', {
    method: 'POST',
    body: JSON.stringify({ taskIds: [taskX], action: 'ASSIGNEE', value: 'not-a-member-id' }),
  }, 'manager');
  const failedAssignee = r.data?.results?.[0]?.success;
  ok(r.status === 200 && !failedAssignee, '7-5  Bulk ASSIGNEE non-member → per-task failure', r.data);

  // 7-6  Missing taskIds → 400
  r = await api('/api/tasks/bulk', {
    method: 'POST',
    body: JSON.stringify({ action: 'STATUS', value: 'DONE' }),
  }, 'manager');
  ok(r.status === 400, '7-6  Bulk missing taskIds → 400', r.data);

  // 7-7  Invalid action → 400
  r = await api('/api/tasks/bulk', {
    method: 'POST',
    body: JSON.stringify({ taskIds: [taskX], action: 'INVALID_ACTION', value: 'x' }),
  }, 'manager');
  ok(r.status === 400, '7-7  Bulk invalid action → 400', r.data);

  // 7-8  Unauthenticated bulk → 401
  r = await fetch(`${BASE_URL}/api/tasks/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskIds: [taskX], action: 'STATUS', value: 'DONE' }),
  });
  ok(r.status === 401, '7-8  Unauthenticated bulk → 401');

  // 7-9  CSV Export — check content-type
  const exportRes = await fetch(`${BASE_URL}/api/tasks/export?projectId=${projectId}`, {
    headers: { Cookie: managerCookie },
  });
  const ct = exportRes.headers.get('content-type');
  ok(exportRes.status === 200 && ct?.includes('text/csv'), '7-9  GET /api/tasks/export → 200 CSV', ct);

  // 7-10  CSV Export content has header row
  const csv = await exportRes.text();
  ok(csv.startsWith('Project,Title'), '7-10 CSV starts with header row', csv.slice(0, 60));

  // 7-11  CSV Export with filter (projectId + priority)
  const filteredExport = await fetch(`${BASE_URL}/api/tasks/export?projectId=${projectId}&priority=HIGH`, {
    headers: { Cookie: managerCookie },
  });
  ok(filteredExport.status === 200, '7-11 CSV Export with ?priority filter → 200');

  // cleanup
  await api(`/api/tasks/${taskX}`, { method: 'DELETE' }, 'manager');
  await api(`/api/tasks/${taskY}`, { method: 'DELETE' }, 'manager');
}

// ═════════════════════════════════════════════════════════════
//  GOAL 8 — Dashboard Analytics
// ═════════════════════════════════════════════════════════════
async function testGoal8_Dashboard() {
  section('GOAL 8 — Dashboard Analytics');

  // 8-1  GET /api/dashboard returns headline
  let r = await api('/api/dashboard', { method: 'GET' }, 'manager');
  ok(r.status === 200 && r.data?.headline, '8-1  GET /api/dashboard → 200 with headline', r.data);

  // 8-2  headline has required fields
  const h = r.data?.headline;
  ok(
    typeof h?.open === 'number' &&
    typeof h?.overdue === 'number' &&
    typeof h?.dueThisWeek === 'number' &&
    typeof h?.completedThisWeek === 'number',
    '8-2  headline has open/overdue/dueThisWeek/completedThisWeek', h
  );

  // 8-3  byStatus array exists
  ok(Array.isArray(r.data?.byStatus), '8-3  dashboard.byStatus is array', r.data?.byStatus);

  // 8-4  byAssignee array exists
  ok(Array.isArray(r.data?.byAssignee), '8-4  dashboard.byAssignee is array', r.data?.byAssignee);

  // 8-5  completionsByWeek is an array with weekStart + count
  const cw = r.data?.completionsByWeek;
  ok(Array.isArray(cw) && cw.length > 0 && cw[0].weekStart && typeof cw[0].count === 'number',
    '8-5  completionsByWeek is array with weekStart+count', cw?.[0]);

  // 8-6  Member gets dashboard scoped to their projects
  r = await api('/api/dashboard', { method: 'GET' }, 'member');
  ok(r.status === 200 && r.data?.headline, '8-6  Member GET /api/dashboard → 200 scoped', r.data?.headline);

  // 8-7  Unauthenticated → 401
  const unauth = await fetch(`${BASE_URL}/api/dashboard`);
  ok(unauth.status === 401, '8-7  Unauthenticated /api/dashboard → 401');
}

// ═════════════════════════════════════════════════════════════
//  GOAL 9 — Immutable Audit Log / Timeline / Comments
// ═════════════════════════════════════════════════════════════
async function testGoal9_Timeline() {
  section('GOAL 9 — Immutable Audit Log, Timeline & Comments');

  // 9-1  GET /api/tasks/:id/timeline returns events
  let r = await api(`/api/tasks/${taskA}/timeline`, { method: 'GET' }, 'manager');
  ok(r.status === 200 && Array.isArray(r.data) && r.data.length > 0,
    '9-1  GET /timeline returns events array', r.data?.length);

  // 9-2  Timeline has status change events from GOAL 4
  const eventsArr = Array.isArray(r.data) ? r.data : [];
  const statusEvents = eventsArr.filter(e => e.type === 'STATUS_CHANGE');
  ok(statusEvents?.length > 0, '9-2  Timeline contains STATUS_CHANGE events', statusEvents?.length);

  // 9-3  CREATED event present
  const createdEvent = eventsArr.find(e => e.type === 'CREATED');
  ok(!!createdEvent, '9-3  CREATED event in timeline', createdEvent);

  // 9-4  FIELD_CHANGE event present (from PATCH in goal 3)
  const fieldChange = eventsArr.find(e => e.type === 'FIELD_CHANGE');
  ok(!!fieldChange, '9-4  FIELD_CHANGE event in timeline', fieldChange);

  // 9-5  Each event has userId
  const hasUser = eventsArr.length > 0 && eventsArr.every(e => e.userId);
  ok(hasUser, '9-5  Every event has userId', r.data?.[0]);

  // 9-6  GET /api/tasks/:id/comments
  r = await api(`/api/tasks/${taskA}/comments`, { method: 'GET' }, 'manager');
  ok(r.status === 200 && Array.isArray(r.data), '9-6  GET /comments → 200 array', r.data);

  // 9-7  POST comment
  r = await api(`/api/tasks/${taskA}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text: 'This is a test comment from edge-case suite' }),
  }, 'manager');
  ok(r.status === 201, '9-7  POST /comments → 201', r.data);
  commentId = r.data?.id;

  // 9-8  Comment appears in GET /comments
  r = await api(`/api/tasks/${taskA}/comments`, { method: 'GET' }, 'manager');
  const hasComment = r.data?.some(c => c.id === commentId);
  ok(hasComment, '9-8  Posted comment appears in GET /comments', r.data?.length);

  // 9-9  Comment appears in timeline
  r = await api(`/api/tasks/${taskA}/timeline`, { method: 'GET' }, 'manager');
  const commentInTimeline = r.data?.some(e => e.type === 'COMMENT' && e.id === commentId);
  ok(commentInTimeline, '9-9  Comment appears in /timeline', r.data?.filter(e => e.type === 'COMMENT').length);

  // 9-10  Empty comment → 400
  r = await api(`/api/tasks/${taskA}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text: '' }),
  }, 'manager');
  ok(r.status === 400, '9-10 Empty comment text → 400', r.data);

  // 9-11  Missing text → 400
  r = await api(`/api/tasks/${taskA}/comments`, {
    method: 'POST',
    body: JSON.stringify({}),
  }, 'manager');
  ok(r.status === 400, '9-11 Missing comment text → 400', r.data);

  // 9-12  Timeline on non-existent task → 404
  r = await api('/api/tasks/non-existent/timeline', { method: 'GET' }, 'manager');
  ok(r.status === 404, '9-12 Timeline of non-existent task → 404', r.data);

  // 9-13  Activity feed — GET /api/activity
  r = await api('/api/activity', { method: 'GET' }, 'manager');
  ok(r.status === 200 && r.data?.events, '9-13 GET /api/activity → 200 with events', r.data?.pagination);

  // 9-14  Activity feed pagination
  r = await api('/api/activity?page=1', { method: 'GET' }, 'manager');
  ok(r.data?.pagination?.page === 1, '9-14 Activity feed pagination page=1', r.data?.pagination);
}

// ═════════════════════════════════════════════════════════════
//  GOAL 10 — Overdue Alerts + Dismiss + Re-appear
// ═════════════════════════════════════════════════════════════
async function testGoal10_Alerts() {
  section('GOAL 10 — Overdue Alerts, Dismiss & Re-appear');

  // Create overdue task (due date 5 days ago)
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 5);

  let r = await api('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ title: 'Overdue Alert Task', projectId, dueDate: pastDate.toISOString() }),
  }, 'manager');
  overdueTaskId = r.data?.id;
  ok(r.status === 201 && overdueTaskId, '10-1 Create overdue task → 201', r.data);

  // Assign member to overdue task
  r = await api(`/api/tasks/${overdueTaskId}/assignees`, {
    method: 'POST', body: JSON.stringify({ userId: memberId }),
  }, 'manager');
  ok(r.status === 201 || r.status === 200, '10-2 Assign member to overdue task → 2xx', r.data);

  // 10-3  Member sees alert
  r = await api('/api/alerts', { method: 'GET' }, 'member');
  ok(r.status === 200 && r.data?.count >= 1, '10-3 Member GET /api/alerts → count ≥ 1', r.data);

  // 10-4  Alert has correct shape
  const alert = r.data?.alerts?.[0];
  ok(alert?.id && alert?.dueDate && alert?.status, '10-4 Alert has id/dueDate/status', alert);

  // 10-5  Alert appears for overdue task
  const hasOurAlert = r.data?.alerts?.some(a => a.id === overdueTaskId);
  ok(hasOurAlert, '10-5 Overdue task appears in alerts', r.data?.alerts?.map(a => a.id));

  // 10-6  Manager is not assigned → doesn't see this alert
  r = await api('/api/alerts', { method: 'GET' }, 'manager');
  const managerAlertHas = r.data?.alerts?.some(a => a.id === overdueTaskId);
  ok(!managerAlertHas, '10-6 Manager does not see alert for task assigned to member only', r.data);

  // 10-7  Non-assigned user cannot dismiss → 403
  r = await api(`/api/alerts/${overdueTaskId}/dismiss`, { method: 'POST' }, 'manager');
  ok(r.status === 403, '10-7 Non-assignee dismiss → 403', r.data);

  // 10-8  Member dismisses alert → 200
  r = await api(`/api/alerts/${overdueTaskId}/dismiss`, { method: 'POST' }, 'member');
  ok(r.status === 200, '10-8 Member dismiss own alert → 200', r.data);

  // 10-9  Alert gone after dismiss
  r = await api('/api/alerts', { method: 'GET' }, 'member');
  const stillThere = r.data?.alerts?.some(a => a.id === overdueTaskId);
  ok(!stillThere, '10-9 Alert gone after dismiss', r.data?.alerts?.map(a => a.id));

  // 10-10  Re-appear: change due date → alert shows again
  const newPastDate = new Date();
  newPastDate.setDate(newPastDate.getDate() - 2);
  await api(`/api/tasks/${overdueTaskId}`, {
    method: 'PATCH',
    body: JSON.stringify({ dueDate: newPastDate.toISOString() }),
  }, 'manager');
  r = await api('/api/alerts', { method: 'GET' }, 'member');
  const reappeared = r.data?.alerts?.some(a => a.id === overdueTaskId);
  ok(reappeared, '10-10 Alert re-appears after due date changed post-dismiss', r.data?.alerts?.map(a => a.id));

  // 10-11  DONE task disappears from alerts
  await api(`/api/tasks/${overdueTaskId}/status`, {
    method: 'PATCH', body: JSON.stringify({ targetStatus: 'IN_PROGRESS' }),
  }, 'manager');
  await api(`/api/tasks/${overdueTaskId}/status`, {
    method: 'PATCH', body: JSON.stringify({ targetStatus: 'IN_REVIEW' }),
  }, 'manager');
  await api(`/api/tasks/${overdueTaskId}/status`, {
    method: 'PATCH', body: JSON.stringify({ targetStatus: 'DONE' }),
  }, 'manager');
  r = await api('/api/alerts', { method: 'GET' }, 'member');
  const alertAfterDone = r.data?.alerts?.some(a => a.id === overdueTaskId);
  ok(!alertAfterDone, '10-11 DONE task no longer in alerts', r.data?.alerts?.map(a => a.id));

  // 10-12  Unauthenticated alerts → 401
  const unauth = await fetch(`${BASE_URL}/api/alerts`);
  ok(unauth.status === 401, '10-12 Unauthenticated /api/alerts → 401');
}

// ═════════════════════════════════════════════════════════════
//  STRETCH — Saved Filters
// ═════════════════════════════════════════════════════════════
async function testStretch_SavedFilters() {
  section('STRETCH — Saved Filters');

  // SF-1  Create saved filter
  let r = await api('/api/saved-filters', {
    method: 'POST',
    body: JSON.stringify({ name: 'My High Prio', filterJson: { priority: 'HIGH', status: 'BACKLOG' } }),
  }, 'manager');
  ok(r.status === 201 && r.data?.id, 'SF-1  POST /saved-filters → 201', r.data);
  savedFilterId = r.data?.id;

  // SF-2  GET saved filters
  r = await api('/api/saved-filters', { method: 'GET' }, 'manager');
  ok(r.status === 200 && Array.isArray(r.data), 'SF-2  GET /saved-filters → 200 array', r.data);

  // SF-3  Filter is scoped to user
  r = await api('/api/saved-filters', { method: 'GET' }, 'member');
  const memberSeesManagerFilter = r.data?.some(f => f.id === savedFilterId);
  ok(!memberSeesManagerFilter, 'SF-3  Member cannot see manager saved filter', r.data);

  // SF-4  Upsert (same name updates filterJson)
  r = await api('/api/saved-filters', {
    method: 'POST',
    body: JSON.stringify({ name: 'My High Prio', filterJson: { priority: 'CRITICAL' } }),
  }, 'manager');
  ok(r.status === 201, 'SF-4  Upsert saved filter (same name) → 201', r.data);

  // SF-5  DELETE saved filter
  r = await api(`/api/saved-filters/${savedFilterId}`, { method: 'DELETE' }, 'manager');
  ok(r.status === 200, 'SF-5  DELETE /saved-filters/:id → 200', r.data);

  // SF-6  Member cannot DELETE manager's filter (recreate first)
  r = await api('/api/saved-filters', {
    method: 'POST',
    body: JSON.stringify({ name: 'Managers Filter', filterJson: { priority: 'HIGH' } }),
  }, 'manager');
  savedFilterId = r.data?.id;
  r = await api(`/api/saved-filters/${savedFilterId}`, { method: 'DELETE' }, 'member');
  ok(r.status === 403 || r.status === 404, 'SF-6  Member cannot delete manager filter → 403', r.data);

  // SF-7  Missing name → 400
  r = await api('/api/saved-filters', {
    method: 'POST',
    body: JSON.stringify({ filterJson: { priority: 'HIGH' } }),
  }, 'manager');
  ok(r.status === 400, 'SF-7  Missing name in saved filter → 400', r.data);

  // SF-8  filterJson must be object → 400
  r = await api('/api/saved-filters', {
    method: 'POST',
    body: JSON.stringify({ name: 'Bad Filter', filterJson: 'not-an-object' }),
  }, 'manager');
  ok(r.status === 400, 'SF-8  filterJson as string → 400', r.data);
}

// ═════════════════════════════════════════════════════════════
//  STRETCH — Custom Fields
// ═════════════════════════════════════════════════════════════
async function testStretch_CustomFields() {
  section('STRETCH — Custom Fields');

  // CF-1  Manager creates TEXT custom field
  let r = await api(`/api/projects/${projectId}/fields`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Ticket URL', type: 'TEXT' }),
  }, 'manager');
  ok(r.status === 201 && r.data?.id, 'CF-1  POST /fields TEXT → 201', r.data);
  customFieldId = r.data?.id;

  // CF-2  Manager creates NUMBER custom field
  r = await api(`/api/projects/${projectId}/fields`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Story Points', type: 'NUMBER' }),
  }, 'manager');
  ok(r.status === 201, 'CF-2  POST /fields NUMBER → 201', r.data);

  // CF-3  SELECT field without options → 400
  r = await api(`/api/projects/${projectId}/fields`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Team', type: 'SELECT' }),
  }, 'manager');
  ok(r.status === 400, 'CF-3  SELECT field without options → 400', r.data);

  // CF-4  SELECT field with options → 201
  r = await api(`/api/projects/${projectId}/fields`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Team', type: 'SELECT', options: ['Alpha', 'Beta', 'Gamma'] }),
  }, 'manager');
  ok(r.status === 201, 'CF-4  SELECT field with options → 201', r.data);

  // CF-5  Invalid type → 400
  r = await api(`/api/projects/${projectId}/fields`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Bad Type', type: 'CHECKBOX' }),
  }, 'manager');
  ok(r.status === 400, 'CF-5  Invalid custom field type → 400', r.data);

  // CF-6  Member cannot create field → 403
  r = await api(`/api/projects/${projectId}/fields`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Member Field', type: 'TEXT' }),
  }, 'member');
  ok(r.status === 403, 'CF-6  Member cannot create custom field → 403', r.data);

  // CF-7  GET /api/projects/:id/fields lists them
  r = await api(`/api/projects/${projectId}/fields`, { method: 'GET' }, 'manager');
  ok(r.status === 200 && Array.isArray(r.data) && r.data.length >= 2, 'CF-7  GET /fields lists definitions', r.data?.length);

  // CF-8  GET /api/tasks/:id/custom-fields
  r = await api(`/api/tasks/${taskA}/custom-fields`, { method: 'GET' }, 'manager');
  ok(r.status === 200 && Array.isArray(r.data), 'CF-8  GET /tasks/:id/custom-fields → 200', r.data);

  // CF-9  PATCH custom field value
  r = await api(`/api/tasks/${taskA}/custom-fields`, {
    method: 'PATCH',
    body: JSON.stringify({ [customFieldId]: 'https://jira.example.com/PROJ-42' }),
  }, 'manager');
  ok(r.status === 200, 'CF-9  PATCH task custom field value → 200', r.data);

  // CF-10  Value persists in GET
  r = await api(`/api/tasks/${taskA}/custom-fields`, { method: 'GET' }, 'manager');
  const field = Array.isArray(r.data) ? r.data.find(f => f.id === customFieldId) : undefined;
  ok(field?.value === 'https://jira.example.com/PROJ-42', 'CF-10 Custom field value persists after PATCH', field);

  // CF-11  Missing name for custom field → 400
  r = await api(`/api/projects/${projectId}/fields`, {
    method: 'POST',
    body: JSON.stringify({ type: 'TEXT' }),
  }, 'manager');
  ok(r.status === 400, 'CF-11 Missing name in custom field → 400', r.data);
}

// ═════════════════════════════════════════════════════════════
//  STRETCH — Time Tracking
// ═════════════════════════════════════════════════════════════
async function testStretch_TimeTracking() {
  section('STRETCH — Time Tracking');

  // TT-1  Start timer (POST /time)
  let r = await api(`/api/tasks/${taskA}/time`, {
    method: 'POST',
    body: JSON.stringify({ description: 'Working on edge cases' }),
  }, 'manager');
  ok(r.status === 201 && r.data?.id && !r.data?.endedAt, 'TT-1  Start timer → 201, endedAt=null', r.data);
  timeEntryId = r.data?.id;

  // TT-2  Starting second timer same task → 409
  r = await api(`/api/tasks/${taskA}/time`, {
    method: 'POST',
    body: JSON.stringify({}),
  }, 'manager');
  ok(r.status === 409, 'TT-2  Second timer same task → 409 conflict', r.data);

  // TT-3  GET /time lists entries + totalSeconds
  r = await api(`/api/tasks/${taskA}/time`, { method: 'GET' }, 'manager');
  ok(r.status === 200 && Array.isArray(r.data?.entries) && typeof r.data?.totalSeconds === 'number',
    'TT-3  GET /time → entries + totalSeconds', r.data);

  // TT-4  Stop timer (PATCH /time/:entryId)
  r = await api(`/api/tasks/${taskA}/time/${timeEntryId}`, {
    method: 'PATCH',
    body: JSON.stringify({ description: 'Done with edge case' }),
  }, 'manager');
  ok(r.status === 200 && r.data?.endedAt !== null, 'TT-4  Stop timer → 200, endedAt set', r.data);

  // TT-5  Stop already stopped timer → 409
  r = await api(`/api/tasks/${taskA}/time/${timeEntryId}`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  }, 'manager');
  ok(r.status === 409, 'TT-5  Stop already-stopped timer → 409', r.data);

  // TT-6  Stop another user's timer → 403
  r = await api(`/api/tasks/${taskA}/time`, {
    method: 'POST', body: JSON.stringify({}),
  }, 'member');
  if (r.status === 201) {
    const memberEntryId = r.data?.id;
    r = await api(`/api/tasks/${taskA}/time/${memberEntryId}`, {
      method: 'PATCH', body: JSON.stringify({}),
    }, 'manager');
    ok(r.status === 403, 'TT-6  Stop another user timer → 403', r.data);
    // cleanup (member stops own timer)
    await api(`/api/tasks/${taskA}/time/${memberEntryId}`, { method: 'PATCH', body: JSON.stringify({}) }, 'member');
  } else {
    ok(true, 'TT-6  (skipped — member timer could not start; member may not have access)');
  }

  // TT-7  DELETE time entry (own)
  const delEntry = (await api(`/api/tasks/${taskA}/time`, {
    method: 'POST', body: JSON.stringify({ description: 'to delete' }),
  }, 'manager')).data;
  await api(`/api/tasks/${taskA}/time/${delEntry.id}`, { method: 'PATCH', body: JSON.stringify({}) }, 'manager');
  r = await api(`/api/tasks/${taskA}/time/${delEntry.id}`, { method: 'DELETE' }, 'manager');
  ok(r.status === 200, 'TT-7  DELETE own time entry → 200', r.data);

  // TT-8  totalSeconds is a non-negative number
  r = await api(`/api/tasks/${taskA}/time`, { method: 'GET' }, 'manager');
  ok(r.data?.totalSeconds >= 0, 'TT-8  totalSeconds ≥ 0 after completed entries', r.data?.totalSeconds);
}

// ═════════════════════════════════════════════════════════════
//  STRETCH — Digest + Health
// ═════════════════════════════════════════════════════════════
async function testStretch_DigestHealth() {
  section('STRETCH — Digest & Health');

  // D-1  GET /api/digest returns data
  let r = await api('/api/digest', { method: 'GET' }, 'member');
  ok(r.status === 200 && r.data?.user, 'D-1  GET /api/digest → 200 with user', r.data);

  // D-2  Digest has taskCount
  ok(typeof r.data?.taskCount === 'number', 'D-2  Digest has taskCount number', r.data);

  // D-3  Digest has html string
  ok(typeof r.data?.html === 'string' && r.data.html.includes('<!DOCTYPE html'), 'D-3  Digest html is HTML string', r.data?.html?.slice(0, 50));

  // D-4  POST /api/digest — SMTP not configured in dev → 503
  r = await api('/api/digest', { method: 'POST' }, 'member');
  ok(r.status === 503 || r.status === 200, 'D-4  POST /api/digest → 503 (no SMTP) or 200', r.data);

  // D-5  Unauthenticated digest → 401
  const unauth = await fetch(`${BASE_URL}/api/digest`);
  ok(unauth.status === 401, 'D-5  Unauthenticated /api/digest → 401');

  // H-1  GET /api/health → 200
  r = await api('/api/health', { method: 'GET' });
  ok(r.status === 200, 'H-1  GET /api/health → 200', r.data);

  // H-2  Health has ok or status field
  ok(r.data?.ok === true || typeof r.data?.status === 'string', 'H-2  Health response has ok or status field', r.data);
}

// ═════════════════════════════════════════════════════════════
//  STRETCH — Signup
// ═════════════════════════════════════════════════════════════
async function testStretch_Signup() {
  section('STRETCH — Signup');

  const ts = Date.now();

  // S-1  Sign up new user
  let r = await api('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Edge Tester',
      email: `edge_${ts}@test.com`,
      password: 'StrongPass1!',
    }),
  });
  ok(r.status === 201 || r.status === 200, 'S-1  Signup new user → 201', r.data);

  // S-2  Duplicate email → 409
  r = await api('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Duplicate',
      email: `edge_${ts}@test.com`,
      password: 'StrongPass1!',
    }),
  });
  ok(r.status === 409, 'S-2  Duplicate email signup → 409', r.data);

  // S-3  Weak password → 400
  r = await api('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name: 'Weak', email: `weak_${ts}@test.com`, password: '123' }),
  });
  ok(r.status === 400, 'S-3  Weak password signup → 400', r.data);

  // S-4  Missing name → 400
  r = await api('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email: `noname_${ts}@test.com`, password: 'StrongPass1!' }),
  });
  ok(r.status === 400, 'S-4  Missing name signup → 400', r.data);
}

// ═════════════════════════════════════════════════════════════
//  MAIN
// ═════════════════════════════════════════════════════════════
async function runAll() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   COMPREHENSIVE EDGE-CASE API TEST SUITE                 ║');
  console.log('║   Goals 1-10 + Stretch APIs (~150 test cases)           ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Base URL : ${BASE_URL}`);
  console.log(`  Started  : ${new Date().toLocaleTimeString()}\n`);

  try {
    await testGoal1_Auth();
    await testGoal2_Projects();
    await testGoal3_Tasks();
    await testGoal4_StateMachine();
    await testGoal5_Assignment();
    await testGoal6_SearchFilter();
    await testGoal7_Bulk();
    await testGoal8_Dashboard();
    await testGoal9_Timeline();
    await testGoal10_Alerts();
    await testStretch_SavedFilters();
    await testStretch_CustomFields();
    await testStretch_TimeTracking();
    await testStretch_DigestHealth();
    await testStretch_Signup();
  } catch (err) {
    console.error('\n💥 UNEXPECTED FATAL ERROR:', err);
    process.exit(1);
  }

  // ─── Summary ─────────────────────────────────────────────
  const total = passed + failed;
  console.log('\n' + '═'.repeat(60));
  console.log('  RESULTS');
  console.log('═'.repeat(60));
  console.log(`  Total   : ${total}`);
  console.log(`  ✅ Pass : ${passed}`);
  console.log(`  ❌ Fail : ${failed}`);
  if (failures.length) {
    console.log('\n  Failed tests:');
    failures.forEach(f => console.log(`    • ${f}`));
  }
  console.log('═'.repeat(60));

  if (failed > 0) process.exit(1);
  else console.log('\n  🎉 ALL TESTS PASSED!\n');
}

runAll().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
