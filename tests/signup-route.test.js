import { describe, it, expect, vi, beforeEach } from "vitest";

// JWT_SECRET is set globally in tests/setup.js (see vitest.config.js setupFiles).

vi.mock("next/server", () => ({
  NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) },
}));
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined, set: () => {} }) }));

const mockPrisma = { user: { findUnique: vi.fn(), create: vi.fn() } };
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const { POST } = await import("../src/app/api/auth/signup/route.js");

function fakeReq(body) {
  return { json: async () => body };
}

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue(null); // no existing account
  });

  it("security requirement: a signup request that tries to set role=MANAGER is created as MEMBER anyway", async () => {
    mockPrisma.user.create.mockResolvedValue({
      id: "u1", email: "eve@example.com", name: "Eve", role: "MEMBER",
    });

    await POST(fakeReq({
      email: "eve@example.com", password: "password123", name: "Eve", role: "MANAGER",
    }));

    // The create call must never receive "MANAGER" — role is hardcoded server-side.
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "MEMBER" }) })
    );
  });

  it("rejects duplicate emails with 409", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "existing" });
    const res = await POST(fakeReq({ email: "eve@example.com", password: "password123", name: "Eve" }));
    expect(res.status).toBe(409);
  });

  it("edge case: rejects a password under 8 characters with 400, before ever touching the DB", async () => {
    const res = await POST(fakeReq({ email: "eve@example.com", password: "short", name: "Eve" }));
    expect(res.status).toBe(400);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("edge case: rejects an invalid email format", async () => {
    const res = await POST(fakeReq({ email: "not-an-email", password: "password123", name: "Eve" }));
    expect(res.status).toBe(400);
  });
});
