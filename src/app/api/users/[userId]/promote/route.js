import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, withErrorHandling, HttpError } from "@/lib/permissions";

// POST /api/users/:userId/promote — managers only. This is the ONLY way a MEMBER becomes a
// MANAGER (besides seeding). Closing the self-service-signup gap in goal 1 means there must
// be a real path to creating additional managers, or the system paints itself into a corner
// with exactly one manager forever. See docs/decisions.md for this trade-off.
export const POST = withErrorHandling(async (_req, { params }) => {
  const session = requireAuth();
  requireRole(session, "MANAGER");

  const target = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!target) throw new HttpError(404, "User not found");

  const updated = await prisma.user.update({
    where: { id: params.userId },
    data: { role: "MANAGER" },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json(updated);
});
