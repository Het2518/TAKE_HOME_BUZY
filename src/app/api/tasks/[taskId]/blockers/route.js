import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireProjectAccess, withErrorHandling, HttpError } from "@/lib/permissions";
import { wouldCreateCycle } from "@/lib/taskStateMachine";
import { writeTaskEvent } from "@/lib/auditLog";

// Shared helper — loads the task or throws 404.
async function loadTask(taskId) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new HttpError(404, "Task not found");
  return task;
}

// GET /api/tasks/:id/blockers — list all tasks that are currently blocking this one.
export const GET = withErrorHandling(async (_req, { params }) => {
  const session = requireAuth();
  const task = await loadTask(params.taskId);
  await requireProjectAccess(session, task.projectId);

  const blockers = await prisma.taskBlocker.findMany({
    where: { taskId: params.taskId },
    include: {
      blockingTask: { select: { id: true, title: true, status: true } },
    },
  });
  return NextResponse.json(blockers);
});

// POST /api/tasks/:id/blockers  body: { blockingTaskId }
// Reuses the same same-project and cycle-detection logic from the PATCH /tasks/:id handler.
// The blocker schema already exists in the DB (TaskBlocker model); this route is what
// makes it actually usable without going through a full task update.
export const POST = withErrorHandling(async (req, { params }) => {
  const session = requireAuth();
  const task = await loadTask(params.taskId);
  await requireProjectAccess(session, task.projectId);

  const { blockingTaskId } = await req.json();
  if (!blockingTaskId) throw new HttpError(400, "blockingTaskId is required");
  if (blockingTaskId === params.taskId) throw new HttpError(422, "A task cannot block itself");

  const blockingTask = await prisma.task.findUnique({ where: { id: blockingTaskId } });
  if (!blockingTask) throw new HttpError(404, "Blocking task not found");
  if (blockingTask.projectId !== task.projectId) {
    throw new HttpError(422, "A task can only be blocked by other tasks in the same project");
  }

  // Cycle detection — same algorithm used in the PATCH route.
  const edges = (
    await prisma.taskBlocker.findMany({ select: { taskId: true, blockingTaskId: true } })
  ).map((e) => [e.taskId, e.blockingTaskId]);

  if (wouldCreateCycle(edges, params.taskId, blockingTaskId)) {
    throw new HttpError(422, "Adding this blocker would create a circular dependency");
  }

  const blocker = await prisma.taskBlocker.upsert({
    where: { taskId_blockingTaskId: { taskId: params.taskId, blockingTaskId } },
    create: { taskId: params.taskId, blockingTaskId },
    update: {}, // already exists — idempotent
  });

  await writeTaskEvent({
    taskId: params.taskId,
    userId: session.userId,
    type: "FIELD_CHANGE",
    field: "blockedBy",
    oldValue: null,
    newValue: blockingTaskId,
  });

  return NextResponse.json(blocker, { status: 201 });
});
