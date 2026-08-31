import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) },
}));

let mockSession = { userId: "user-1", role: "MEMBER" };
vi.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined, set: () => {} }),
}));
vi.mock("@/lib/auth", () => ({
  getSessionFromCookies: () => mockSession,
}));

const mockPrisma = {
  task: { findUnique: vi.fn(), update: vi.fn() },
  taskBlocker: { findMany: vi.fn() },
  taskEvent: { create: vi.fn() },
  project: { findUnique: vi.fn() },
  projectMember: { findUnique: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { PATCH } = await import("../src/app/api/tasks/[taskId]/status/route.js");

function fakeReq(body) {
  return { json: async () => body };
}

describe("PATCH /api/tasks/:id/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = { userId: "user-1", role: "MEMBER" };
    mockPrisma.project.findUnique.mockResolvedValue({ id: "proj-1", ownerId: "someone-else" });
    mockPrisma.projectMember.findUnique.mockResolvedValue({ id: "m1" }); // is a member
  });

  it("requirement: rejects an unauthenticated request", async () => {
    mockSession = null;
    mockPrisma.task.findUnique.mockResolvedValue({ id: "t1", projectId: "proj-1", status: "BACKLOG" });
    const res = await PATCH(fakeReq({ targetStatus: "IN_PROGRESS" }), { params: { taskId: "t1" } });
    expect(res.status).toBe(401);
  });

  it("requirement: 404 when the task does not exist", async () => {
    mockPrisma.task.findUnique.mockResolvedValue(null);
    const res = await PATCH(fakeReq({ targetStatus: "IN_PROGRESS" }), { params: { taskId: "missing" } });
    expect(res.status).toBe(404);
  });

  it("requirement: 403 when the user is not a member of the task's project", async () => {
    mockPrisma.task.findUnique.mockResolvedValue({ id: "t1", projectId: "proj-1", status: "BACKLOG" });
    mockPrisma.projectMember.findUnique.mockResolvedValue(null); // not a member
    const res = await PATCH(fakeReq({ targetStatus: "IN_PROGRESS" }), { params: { taskId: "t1" } });
    expect(res.status).toBe(403);
  });

  it("requirement: accepts a legal transition, writes the new status, and logs a STATUS_CHANGE event", async () => {
    mockPrisma.task.findUnique.mockResolvedValue({
      id: "t1", projectId: "proj-1", status: "BACKLOG", blockedFromStatus: null,
    });
    mockPrisma.taskBlocker.findMany.mockResolvedValue([]);
    mockPrisma.task.update.mockResolvedValue({ id: "t1", status: "IN_PROGRESS" });

    const res = await PATCH(fakeReq({ targetStatus: "IN_PROGRESS" }), { params: { taskId: "t1" } });

    expect(res.status).toBe(200);
    expect(mockPrisma.task.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { status: "IN_PROGRESS" },
    });
    expect(mockPrisma.taskEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          taskId: "t1", type: "STATUS_CHANGE", oldValue: "BACKLOG", newValue: "IN_PROGRESS",
        }),
      })
    );
  });

  it("requirement: rejects an illegal jump with a 422 and does NOT write to the DB", async () => {
    mockPrisma.task.findUnique.mockResolvedValue({
      id: "t1", projectId: "proj-1", status: "BACKLOG", blockedFromStatus: null,
    });
    mockPrisma.taskBlocker.findMany.mockResolvedValue([]);

    const res = await PATCH(fakeReq({ targetStatus: "DONE" }), { params: { taskId: "t1" } });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/not a legal transition/i);
    expect(mockPrisma.task.update).not.toHaveBeenCalled();
    expect(mockPrisma.taskEvent.create).not.toHaveBeenCalled();
  });

  it("requirement: rejects moving to DONE while a blocker is incomplete, with a clear reason, no DB write", async () => {
    mockPrisma.task.findUnique.mockResolvedValue({
      id: "t1", projectId: "proj-1", status: "IN_REVIEW", blockedFromStatus: null,
    });
    mockPrisma.taskBlocker.findMany.mockResolvedValue([
      { blockingTask: { status: "IN_PROGRESS" } }, // not done yet
    ]);

    const res = await PATCH(fakeReq({ targetStatus: "DONE" }), { params: { taskId: "t1" } });

    expect(res.status).toBe(422);
    expect(res.body.error).toMatch(/blocking task/i);
    expect(mockPrisma.task.update).not.toHaveBeenCalled();
  });

  it("requirement: allows moving to DONE once every blocker IS done", async () => {
    mockPrisma.task.findUnique.mockResolvedValue({
      id: "t1", projectId: "proj-1", status: "IN_REVIEW", blockedFromStatus: null,
    });
    mockPrisma.taskBlocker.findMany.mockResolvedValue([{ blockingTask: { status: "DONE" } }]);
    mockPrisma.task.update.mockResolvedValue({ id: "t1", status: "DONE" });

    const res = await PATCH(fakeReq({ targetStatus: "DONE" }), { params: { taskId: "t1" } });
    expect(res.status).toBe(200);
  });

  it("requirement: unblocking restores the exact prior status and clears blockedFromStatus", async () => {
    mockPrisma.task.findUnique.mockResolvedValue({
      id: "t1", projectId: "proj-1", status: "BLOCKED", blockedFromStatus: "IN_REVIEW",
    });
    mockPrisma.taskBlocker.findMany.mockResolvedValue([]);
    mockPrisma.task.update.mockResolvedValue({ id: "t1", status: "IN_REVIEW" });

    const res = await PATCH(fakeReq({ targetStatus: "UNBLOCK" }), { params: { taskId: "t1" } });

    expect(res.status).toBe(200);
    expect(mockPrisma.task.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { status: "IN_REVIEW", blockedFromStatus: null },
    });
  });

  it("requirement: entering BLOCKED stores which status to return to", async () => {
    mockPrisma.task.findUnique.mockResolvedValue({
      id: "t1", projectId: "proj-1", status: "IN_PROGRESS", blockedFromStatus: null,
    });
    mockPrisma.taskBlocker.findMany.mockResolvedValue([]);
    mockPrisma.task.update.mockResolvedValue({ id: "t1", status: "BLOCKED" });

    await PATCH(fakeReq({ targetStatus: "BLOCKED" }), { params: { taskId: "t1" } });

    expect(mockPrisma.task.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { status: "BLOCKED", blockedFromStatus: "IN_PROGRESS" },
    });
  });

  it("edge case: rejects a body with a missing/invalid targetStatus (400, not a 500 crash)", async () => {
    mockPrisma.task.findUnique.mockResolvedValue({ id: "t1", projectId: "proj-1", status: "BACKLOG" });
    const res = await PATCH(fakeReq({}), { params: { taskId: "t1" } });
    expect(res.status).toBe(400);
  });

  it("edge case: managers pass the project-access check without a membership row (portfolio-wide access)", async () => {
    mockSession = { userId: "manager-1", role: "MANAGER" };
    mockPrisma.projectMember.findUnique.mockResolvedValue(null); // manager is NOT a member row
    mockPrisma.task.findUnique.mockResolvedValue({
      id: "t1", projectId: "proj-1", status: "BACKLOG", blockedFromStatus: null,
    });
    mockPrisma.taskBlocker.findMany.mockResolvedValue([]);
    mockPrisma.task.update.mockResolvedValue({ id: "t1", status: "IN_PROGRESS" });

    const res = await PATCH(fakeReq({ targetStatus: "IN_PROGRESS" }), { params: { taskId: "t1" } });
    expect(res.status).toBe(200); // would be 403 if managers were still membership-scoped
  });
});
