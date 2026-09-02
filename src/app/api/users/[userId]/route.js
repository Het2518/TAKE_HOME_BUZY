import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, withErrorHandling, HttpError } from "@/lib/permissions";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
}).refine((d) => d.name || d.email, { message: "Provide at least name or email" });

// GET /api/users/:id — any authenticated user can view a public profile.
// passwordHash is never included — the select list is the guard.
export const GET = withErrorHandling(async (_req, { params }) => {
  await requireAuth();
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  if (!user) throw new HttpError(404, "User not found");
  return NextResponse.json(user);
});

// PATCH /api/users/:id — managers only. Lets a manager fix a user's name or email
// without having to reseed the database. Password resets are not here — the user
// must use PATCH /api/auth/me with their current password.
export const PATCH = withErrorHandling(async (req, { params }) => {
  const session = await requireAuth();
  requireRole(session, "MANAGER");

  const body = await req.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);

  const updated = await prisma.user.update({
    where: { id: params.userId },
    data: parsed.data,
    select: { id: true, name: true, email: true, role: true },
  });
  return NextResponse.json(updated);
});

