import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, withErrorHandling } from "@/lib/permissions";

// GET /api/users — managers only, used to populate the owner picker on project creation
// and could back a future member-picker dropdown too. Never returns passwordHash.
export const GET = withErrorHandling(async () => {
  const session = requireAuth();
  requireRole(session, "MANAGER");

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users);
});
