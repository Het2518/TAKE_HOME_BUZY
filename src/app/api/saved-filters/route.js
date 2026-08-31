import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, withErrorHandling, HttpError } from "@/lib/permissions";

// STRETCH GOAL: saved filter views (goal-6 extension). Reuses the exact query-param shape
// GET /api/tasks already accepts, stored as JSON, scoped to the logged-in user only.

export const GET = withErrorHandling(async () => {
  const session = requireAuth();
  const filters = await prisma.savedFilter.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(filters);
});

export const POST = withErrorHandling(async (req) => {
  const session = requireAuth();
  const { name, filterJson } = await req.json();
  if (!name || typeof filterJson !== "object") {
    throw new HttpError(400, "name and filterJson (object) are required");
  }

  const saved = await prisma.savedFilter.upsert({
    where: { userId_name: { userId: session.userId, name } },
    create: { userId: session.userId, name, filterJson: JSON.stringify(filterJson) },
    update: { filterJson: JSON.stringify(filterJson) },
  });

  return NextResponse.json(saved, { status: 201 });
});
