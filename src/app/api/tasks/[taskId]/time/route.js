import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, withErrorHandling, HttpError } from "@/lib/permissions";

// GET /api/tasks/:id/time — list all time entries for a task
// POST /api/tasks/:id/time — start a new timer (endedAt = null)

export const GET = withErrorHandling(async (_req, { params }) => {
  const session = await requireAuth();
  const { taskId } = await params;
  const entries = await prisma.timeEntry.findMany({
    where: { taskId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { startedAt: "desc" },
  });
  // Total logged seconds (finished entries only)
  const totalSeconds = entries
    .filter((e) => e.endedAt)
    .reduce((sum, e) => sum + Math.round((e.endedAt - e.startedAt) / 1000), 0);

  return NextResponse.json({ entries, totalSeconds });
});

export const POST = withErrorHandling(async (req, { params }) => {
  const session = await requireAuth();
  const { taskId } = await params;

  // One open timer per user per task — reject if one already exists
  const open = await prisma.timeEntry.findFirst({
    where: { taskId, userId: session.userId, endedAt: null },
  });
  if (open) throw new HttpError(409, "Timer already running for this task");

  const body = await req.json().catch(() => ({}));
  const entry = await prisma.timeEntry.create({
    data: {
      taskId,
      userId: session.userId,
      description: body.description || "",
    },
  });
  return NextResponse.json(entry, { status: 201 });
});

