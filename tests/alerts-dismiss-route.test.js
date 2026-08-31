import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) },
}));
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined, set: () => {} }) }));

let mockSession = { userId: "user-1", role: "MEMBER" };
vi.mock("@/lib/auth", () => ({ getSessionFromCookies: () => mockSession }));

const mockPrisma = {
  taskAssignee: { findUnique: vi.fn() },
  alertDismissal: { upsert: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { POST } = await import("../src/app/api/alerts/[taskId]/dismiss/route.js");

describe("POST /api/alerts/:taskId/dismiss", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = { userId: "user-1", role: "MEMBER" };
  });

  it("requirement: a user may dismiss an alert for a task they ARE assigned to", async () => {
    mockPrisma.taskAssignee.findUnique.mockResolvedValue({ id: "assignment-1" });
    mockPrisma.alertDismissal.upsert.mockResolvedValue({ id: "d1", taskId: "t1", userId: "user-1" });

    const res = await POST({}, { params: { taskId: "t1" } });

    expect(res.status).toBe(200);
    expect(mockPrisma.alertDismissal.upsert).toHaveBeenCalled();
  });

  it("requirement: a user may NOT dismiss an alert for a task they are not assigned to", async () => {
    mockPrisma.taskAssignee.findUnique.mockResolvedValue(null); // not assigned

    const res = await POST({}, { params: { taskId: "t1" } });

    expect(res.status).toBe(403);
    expect(mockPrisma.alertDismissal.upsert).not.toHaveBeenCalled();
  });

  it("edge case: this holds even for a manager — assignment, not role, is what's checked", async () => {
    mockSession = { userId: "manager-1", role: "MANAGER" };
    mockPrisma.taskAssignee.findUnique.mockResolvedValue(null); // manager not assigned to this task

    const res = await POST({}, { params: { taskId: "t1" } });

    expect(res.status).toBe(403);
  });
});
