import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) },
}));
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined, set: () => {} }) }));

let mockSession = { userId: "user-1", role: "MEMBER" };
vi.mock("@/lib/auth", () => ({ getSessionFromCookies: () => mockSession }));

const mockPrisma = {
  task: { findUnique: vi.fn(), update: vi.fn() },
  taskBlocker: { findMany: vi.fn() },
  taskEvent: { create: vi.fn() },
  taskAssignee: { upsert: vi.fn() },
  projectMember: { findUnique: vi.fn() },
  project: { findUnique: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { POST } = await import("../src/app/api/tasks/bulk/route.js");

function fakeReq(body) {
  return { json: async () => body };
}

describe("POST /api/tasks/bulk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = { userId: "user-1", role: "MEMBER" };
    mockPrisma.project.findUnique.mockResolvedValue({ id: "proj-1", ownerId: "someone-else" });
    mockPrisma.projectMember.findUnique.mockResolvedValue({ id: "m1" });
  });

  it("requirement: mixed outcomes report per-task success/failure, not an all-or-nothing batch", async () => {
    mockPrisma.task.findUnique.mockImplementation(({ where: { id } }) => {
      if (id === "ok-task") return Promise.resolve({ id: "ok-task", projectId: "proj-1", status: "IN_REVIEW", blockedFromStatus: null });
      if (id === "blocked-task") return Promise.resolve({ id: "blocked-task", projectId: "proj-1", status: "IN_REVIEW", blockedFromStatus: null });
      return Promise.resolve(null);
    });
    mockPrisma.taskBlocker.findMany.mockImplementation(({ where: { taskId } }) => {
      if (taskId === "blocked-task") return Promise.resolve([{ blockingTask: { status: "IN_PROGRESS" } }]); // incomplete
      return Promise.resolve([]); // ok-task has no blockers
    });
    mockPrisma.task.update.mockResolvedValue({});

    const res = await POST(fakeReq({
      taskIds: ["ok-task", "blocked-task"],
      action: "STATUS",
      value: "DONE",
    }));

    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.results.map((r) => [r.taskId, r]));
    expect(byId["ok-task"].success).toBe(true);
    expect(byId["blocked-task"].success).toBe(false);
    expect(byId["blocked-task"].message).toMatch(/blocking task/i);
    // The successful one must still have been written even though the other failed.
    expect(mockPrisma.task.update).toHaveBeenCalledTimes(1);
  });

  it("edge case: a nonexistent task id reports not-found for that task only, doesn't throw", async () => {
    mockPrisma.task.findUnique.mockImplementation(({ where: { id } }) => {
      if (id === "real-task") return Promise.resolve({ id: "real-task", projectId: "proj-1", status: "BACKLOG", blockedFromStatus: null });
      return Promise.resolve(null);
    });
    mockPrisma.taskBlocker.findMany.mockResolvedValue([]);
    mockPrisma.task.update.mockResolvedValue({});

    const res = await POST(fakeReq({ taskIds: ["real-task", "ghost-task"], action: "STATUS", value: "IN_PROGRESS" }));

    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.results.map((r) => [r.taskId, r]));
    expect(byId["real-task"].success).toBe(true);
    expect(byId["ghost-task"].success).toBe(false);
    expect(byId["ghost-task"].message).toMatch(/not found/i);
  });

  it("edge case: a task in a project the user can't access is reported as failed, not a 403 for the whole request", async () => {
    mockPrisma.task.findUnique.mockResolvedValue({ id: "t1", projectId: "other-proj", status: "BACKLOG", blockedFromStatus: null });
    mockPrisma.project.findUnique.mockResolvedValue({ id: "other-proj", ownerId: "nobody" });
    mockPrisma.projectMember.findUnique.mockResolvedValue(null); // not a member of that project

    const res = await POST(fakeReq({ taskIds: ["t1"], action: "STATUS", value: "IN_PROGRESS" }));

    expect(res.status).toBe(200); // the request itself succeeds
    expect(res.body.results[0].success).toBe(false);
    expect(res.body.results[0].message).toMatch(/not authorized/i);
  });

  it("edge case: rejects a malformed body (empty taskIds array) with 400", async () => {
    const res = await POST(fakeReq({ taskIds: [], action: "STATUS", value: "IN_PROGRESS" }));
    expect(res.status).toBe(400);
  });

  it("ASSIGNEE action: rejects assigning a user who isn't a member of the task's project", async () => {
    mockPrisma.task.findUnique.mockResolvedValue({ id: "t1", projectId: "proj-1", status: "BACKLOG" });
    mockPrisma.projectMember.findUnique
      .mockResolvedValueOnce({ id: "m1" }) // requester's own membership check (requireProjectAccess)
      .mockResolvedValueOnce(null); // target assignee is NOT a member

    const res = await POST(fakeReq({ taskIds: ["t1"], action: "ASSIGNEE", value: "not-a-member" }));

    expect(res.body.results[0].success).toBe(false);
    expect(res.body.results[0].message).toMatch(/not a member/i);
  });
});
