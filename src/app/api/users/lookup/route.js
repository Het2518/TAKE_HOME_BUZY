import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, withErrorHandling, HttpError } from "@/lib/permissions";

// GET /api/users/lookup?email=... — managers only, used to resolve an email to a user id
// when adding a project member. Deliberately returns only id/name/email, never passwordHash.
export const GET = withErrorHandling(async (req) => {
  const session = await requireAuth();
  requireRole(session, "MANAGER");

  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email");
  if (!email) throw new HttpError(400, "email query param is required");

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });
  if (!user) throw new HttpError(404, "No user found with that email");

  return NextResponse.json(user);
});


