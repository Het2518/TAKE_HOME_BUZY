import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken, setSessionCookie } from "@/lib/auth";
import { loginSchema } from "@/lib/validators";
import { withErrorHandling, HttpError } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/rateLimit";

export const POST = withErrorHandling(async (req) => {
  // Block brute-force attempts. IP comes from the reverse proxy header on Vercel/Railway;
  // falls back to a fixed key in local dev where there's no proxy.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (!checkRateLimit(ip)) {
    throw new HttpError(429, "Too many login attempts — try again in 15 minutes");
  }

  const body = await req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "Email and password are required");

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  // Same error for "no such user" and "wrong password" — don't leak which one it was.
  if (!user) throw new HttpError(401, "Invalid email or password");
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) throw new HttpError(401, "Invalid email or password");

  const token = signToken({ userId: user.id, role: user.role });
  setSessionCookie(token);

  return NextResponse.json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

