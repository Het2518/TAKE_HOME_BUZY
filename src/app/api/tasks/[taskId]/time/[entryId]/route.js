import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, withErrorHandling, HttpError } from "@/lib/permissions";

// PATCH /api/tasks/:taskId/time/:entryId — stop a running timer, optionally set description
export const PATCH = withErrorHandling(async (req, { params }) => {
  const session = await requireAuth();
  const entry = await prisma.timeEntry.findUnique({ where: { id: params.entryId } });
  if (!entry) throw new HttpError(404, "Time entry not found");
  if (entry.userId !== session.userId) throw new HttpError(403, "You can only stop your own timer");
  if (entry.endedAt) throw new HttpError(409, "Timer already stopped");

  const body = await req.json().catch(() => ({}));
  const updated = await prisma.timeEntry.update({
    where: { id: params.entryId },
    data: {
      endedAt: new Date(),
      description: body.description ?? entry.description,
    },
  });
  return NextResponse.json(updated);
});

// DELETE /api/tasks/:taskId/time/:entryId — delete a manual/mistaken entry
export const DELETE = withErrorHandling(async (_req, { params }) => {
  const session = await requireAuth();
  const entry = await prisma.timeEntry.findUnique({ where: { id: params.entryId } });
  if (!entry) throw new HttpError(404, "Time entry not found");
  if (entry.userId !== session.userId) throw new HttpError(403, "You can only delete your own entries");

  await prisma.timeEntry.delete({ where: { id: params.entryId } });
  return NextResponse.json({ ok: true });
});

