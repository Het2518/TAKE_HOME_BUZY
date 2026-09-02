import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, withErrorHandling, HttpError } from "@/lib/permissions";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { updateMeSchema } from "@/lib/validators";

export const GET = withErrorHandling(async () => {
  const session = requireAuth();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, role: true },
  });
  return NextResponse.json(user);
});

// PATCH /api/auth/me — update own name and/or password.
// Changing the password requires sending the current one first so a stolen session
// token alone isn't enough to lock a user out of their own account.
export const PATCH = withErrorHandling(async (req) => {
  const session = requireAuth();
  const body = await req.json();
  const parsed = updateMeSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);

  const { name, currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });

  if (newPassword) {
    if (!currentPassword) throw new HttpError(400, "currentPassword is required to set a new password");
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) throw new HttpError(403, "Current password is incorrect");
  }

  const data = {};
  if (name) data.name = name;
  if (newPassword) data.passwordHash = await hashPassword(newPassword);

  const updated = await prisma.user.update({
    where: { id: session.userId },
    data,
    select: { id: true, email: true, name: true, role: true },
  });
  return NextResponse.json(updated);
});

