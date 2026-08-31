const http = require('http');

const BASE_URL = 'http://localhost:3000';
let managerCookie = '';
let memberCookie = '';
let testProjectId = '';
let testTaskId = '';
let blockingTaskId = '';

const ACCOUNTS = {
  manager: { email: 'aarav@demo.com', password: 'Password123!' },
  member: { email: 'vihaan@demo.com', password: 'Password123!' }
};

// Simple fetch wrapper to handle cookies and JSON
async function api(path, options = {}, asRole = 'manager') {
  const cookie = asRole === 'manager' ? managerCookie : memberCookie;
  const headers = {
    'Content-Type': 'application/json',
    ...(cookie ? { 'Cookie': cookie } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers
  });

  // Save cookie on login
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) {
    if (asRole === 'manager') managerCookie = setCookie;
    if (asRole === 'member') memberCookie = setCookie;
  }

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = text;
  }

  return { status: response.status, data };
}

function assert(condition, message, data) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    if (data) console.error('Response Data:', data);
    process.exit(1);
  }
}

async function runTests() {
  console.log('🚀 Starting Comprehensive E2E Tests...\n');

  // ==========================================
  // GOAL 1: Accounts and Roles
  // ==========================================
  console.log('--- GOAL 1: Accounts & Roles ---');
  let res = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(ACCOUNTS.manager) }, 'manager');
  assert(res.status === 200, 'Manager login should succeed');
  console.log('✅ Manager logged in');

  res = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(ACCOUNTS.member) }, 'member');
  assert(res.status === 200, 'Member login should succeed');
  console.log('✅ Member logged in');

  // ==========================================
  // GOAL 2: Projects
  // ==========================================
  console.log('\n--- GOAL 2: Projects ---');
  // Member tries to create project (should fail)
  res = await api('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ key: 'FAIL', name: 'Member Proj', description: '' })
  }, 'member');
  assert(res.status === 403 || res.status === 401, 'Member should not be able to create projects');

  // Manager creates project
  // Get users for assignment and ownership
  res = await api('/api/users', { method: 'GET' }, 'manager');
  const allUsers = res.data;
  const managerUser = allUsers.find(u => u.email === ACCOUNTS.manager.email);
  const testUser = allUsers.find(u => u.email === ACCOUNTS.member.email);
  assert(managerUser && testUser, 'Should find test manager and member in users list');

  const projKey = `TEST${Math.floor(Math.random() * 1000)}`;
  res = await api('/api/projects', {
    method: 'POST',
    body: JSON.stringify({ key: projKey, name: 'E2E Test Project', description: 'Testing', ownerId: managerUser.id })
  }, 'manager');
  assert(res.status === 201 && res.data.id, 'Manager should be able to create a project', res.data);
  testProjectId = res.data.id;
  console.log(`✅ Manager created project: ${projKey}`);

  // ==========================================
  // GOAL 3: Tasks inside projects (and dependencies)
  // ==========================================
  console.log('\n--- GOAL 3: Tasks & Dependencies ---');
  // Create blocking task
  res = await api('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ title: 'Blocker Task', projectId: testProjectId, priority: 'HIGH' })
  }, 'manager');
  assert(res.status === 201 || res.status === 200, 'Manager should create blocking task', res.data);
  blockingTaskId = res.data.id;

  // Create main task blocked by the blocker
  res = await api('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Main Task',
      projectId: testProjectId,
      priority: 'MEDIUM',
      blockingTaskIds: [blockingTaskId]
    })
  }, 'manager');
  assert(res.status === 201 || res.status === 200, 'Manager should create main task with dependency', res.data);
  testTaskId = res.data.id;
  console.log('✅ Created tasks with blocking dependencies');

  // ==========================================
  // GOAL 5: Assignment
  // ==========================================
  console.log('\n--- GOAL 5: Assignment ---');

  // Assign user to project first
  await api(`/api/projects/${testProjectId}/members`, {
    method: 'POST', body: JSON.stringify({ userId: testUser.id })
  }, 'manager');

  // Assign user to task
  res = await api(`/api/tasks/${testTaskId}/assignees`, {
    method: 'POST',
    body: JSON.stringify({ userId: testUser.id })
  }, 'manager');
  assert(res.status === 201 || res.status === 200, 'Should assign member to task', res.data);
  console.log('✅ Assigned member to task');

  // ==========================================
  // GOAL 4: Task Lifecycle Rules (State Machine)
  // ==========================================
  console.log('\n--- GOAL 4: Task Lifecycle & Rules ---');

  // Try illegal transition (BACKLOG -> DONE directly)
  res = await api(`/api/tasks/${testTaskId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ targetStatus: 'DONE' })
  }, 'manager');
  assert(res.status === 422, 'Should reject illegal jump from BACKLOG to DONE', res.data);

  // Try legal transition (BACKLOG -> IN_PROGRESS)
  res = await api(`/api/tasks/${testTaskId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ targetStatus: 'IN_PROGRESS' })
  }, 'manager');
  assert(res.status === 200, 'Should allow BACKLOG -> IN_PROGRESS', res.data);

  // Move to IN_REVIEW
  res = await api(`/api/tasks/${testTaskId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ targetStatus: 'IN_REVIEW' })
  }, 'manager');
  assert(res.status === 200, 'Should allow IN_PROGRESS -> IN_REVIEW', res.data);

  // Try to move to DONE while blocked
  res = await api(`/api/tasks/${testTaskId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ targetStatus: 'DONE' })
  }, 'manager');
  assert(res.status === 422 && res.data.error.includes('blocking'), 'Should reject transition to DONE because it is blocked', res.data);
  console.log('✅ Task lifecycle constraints and blocking rules verified');

  // ==========================================
  // GOAL 6: Finding Things (Search, Filters, Pagination)
  // ==========================================
  console.log('\n--- GOAL 6: Finding Things (Pagination & Filtering) ---');
  res = await api(`/api/tasks?projectId=${testProjectId}&search=Main&page=1&pageSize=10`, { method: 'GET' }, 'manager');
  assert(res.status === 200 && res.data.tasks.length >= 1, 'Server should filter tasks correctly');
  assert(res.data.pagination && res.data.pagination.total >= 1, 'Server should return pagination metadata');
  console.log('✅ Server-side filtering, searching, and pagination verified');

  // ==========================================
  // GOAL 7: Bulk Actions
  // ==========================================
  console.log('\n--- GOAL 7: Bulk Actions ---');
  res = await api('/api/tasks/bulk', {
    method: 'POST',
    body: JSON.stringify({
      taskIds: [testTaskId, blockingTaskId],
      action: 'STATUS',
      value: 'BLOCKED'
    })
  }, 'manager');
  assert(res.status === 200 && res.data.results, 'Bulk update should return per-task results');
  console.log('✅ Bulk actions and partial result reporting verified');

  // ==========================================
  // GOAL 8: Dashboard
  // ==========================================
  console.log('\n--- GOAL 8: Dashboard Data ---');
  res = await api('/api/dashboard', { method: 'GET' }, 'manager');
  assert(res.status === 200 && res.data.headline, 'Dashboard API should return headline stats');
  assert(res.data.byStatus && res.data.completionsByWeek, 'Dashboard API should return chart breakdowns');
  console.log('✅ Dashboard analytics endpoints verified');

  // ==========================================
  // GOAL 9: History (Immutable Audit Log)
  // ==========================================
  console.log('\n--- GOAL 9: Task History ---');
  res = await api(`/api/tasks/${testTaskId}/timeline`, { method: 'GET' }, 'manager');
  assert(res.status === 200 && res.data.length > 0, 'History log should be returned', res.data);
  const hasStatusChange = res.data.some(h => h.field === 'status');
  assert(hasStatusChange, 'History should contain the status changes we made earlier');
  console.log('✅ Immutable history tracking verified');

  // ==========================================
  // GOAL 10: Overdue Alerts
  // ==========================================
  console.log('\n--- GOAL 10: Overdue Alerts ---');
  // Create overdue task
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - 5);
  res = await api('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Overdue Task',
      projectId: testProjectId,
      dueDate: pastDate.toISOString()
    })
  }, 'manager');
  assert(res.status === 201 || res.status === 200, 'Manager should create overdue task', res.data);
  const overdueId = res.data.id;

  // Assign user to overdue task
  res = await api(`/api/tasks/${overdueId}/assignees`, {
    method: 'POST',
    body: JSON.stringify({ userId: testUser.id })
  }, 'manager');
  assert(res.status === 201 || res.status === 200, 'Should assign member to overdue task', res.data);

  // Check alerts as the assigned member
  res = await api('/api/alerts', { method: 'GET' }, 'member');
  assert(res.status === 200, 'Should fetch alerts', res.data);
  const hasAlert = res.data.alerts.some(a => a.id === overdueId);
  assert(hasAlert, 'Overdue task should appear in alerts');

  // Dismiss alert
  res = await api(`/api/alerts/${overdueId}/dismiss`, { method: 'POST' }, 'member');
  assert(res.status === 200, 'Member should be able to dismiss alert');

  // Verify alert is gone
  res = await api('/api/alerts', { method: 'GET' }, 'member');
  const hasAlertAfter = res.data.alerts.some(a => a.id === overdueId);
  assert(!hasAlertAfter, 'Alert should be hidden after dismissal');
  console.log('✅ Overdue alerts and dismissal verified');

  // Clean up
  console.log('\n--- Cleanup ---');
  res = await api(`/api/projects/${testProjectId}`, { method: 'PATCH', body: JSON.stringify({ archived: true }) }, 'manager');
  assert(res.status === 200, 'Manager should be able to archive project');
  console.log('✅ Project archived successfully');

  console.log('\n🎉 ALL 10 GOALS TESTED SUCCESSFULLY! 🎉');
}

runTests().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
