import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken, setSessionCookie } from "@/lib/auth";
import { signupSchema } from "@/lib/validators";
import { withErrorHandling, HttpError } from "@/lib/permissions";

export const POST = withErrorHandling(async (req) => {
  const body = await req.json();
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0].message);
  }
  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(409, "An account with that email already exists");

  const passwordHash = await hashPassword(password);
  // Always MEMBER on self-service signup — see docs/decisions.md. There is no client-facing
  // way to become a MANAGER; manager accounts are seeded, or promoted via
  // POST /api/users/:id/promote by an existing manager (see that route).
  const user = await prisma.user.create({
    data: { email, passwordHash, name, role: "MEMBER" },
  });

  const token = signToken({ userId: user.id, role: user.role });
  await setSessionCookie(token);

  return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});
