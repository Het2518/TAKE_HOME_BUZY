import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, withErrorHandling } from "@/lib/permissions";

// GET /api/users — all authenticated users may list users (no passwordHash ever returned).
// Originally restricted to managers only, but members also need this to populate the
// assignee filter on the All Tasks page (goal 6) and member-picker dropdowns.
export const GET = withErrorHandling(async () => {
  await requireAuth();

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(users);
});


