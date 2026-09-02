import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireProjectAccess, withErrorHandling, HttpError } from "@/lib/permissions";
import { writeTaskEvent } from "@/lib/auditLog";

// DELETE /api/tasks/:taskId/blockers/:blockingTaskId
// Removes a specific blocker relationship. The :blockingTaskId param is the ID of the
// task that is blocking — i.e. the other end of the edge, not the TaskBlocker row id.
// This is more natural in the URL ("remove task X from the blockers of task Y") and
// avoids exposing internal join-table row ids to the client.
export const DELETE = withErrorHandling(async (_req, { params }) => {
  const session = await requireAuth();
  const task = await prisma.task.findUnique({ where: { id: params.taskId } });
  if (!task) throw new HttpError(404, "Task not found");
  await requireProjectAccess(session, task.projectId);

  const existing = await prisma.taskBlocker.findUnique({
    where: {
      taskId_blockingTaskId: {
        taskId: params.taskId,
        blockingTaskId: params.blockingTaskId,
      },
    },
  });
  if (!existing) throw new HttpError(404, "Blocker relationship not found");

  await prisma.taskBlocker.delete({
    where: {
      taskId_blockingTaskId: {
        taskId: params.taskId,
        blockingTaskId: params.blockingTaskId,
      },
    },
  });

  await writeTaskEvent({
    taskId: params.taskId,
    userId: session.userId,
    type: "FIELD_CHANGE",
    field: "blockedBy",
    oldValue: params.blockingTaskId,
    newValue: null,
  });

  return NextResponse.json({ ok: true });
});

