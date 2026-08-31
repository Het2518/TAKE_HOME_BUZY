import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  requireRole,
  requireProjectAccess,
  withErrorHandling,
  HttpError,
} from "@/lib/permissions";
import { updateTaskSchema } from "@/lib/validators";
import { writeTaskEvent } from "@/lib/auditLog";
import { wouldCreateCycle } from "@/lib/taskStateMachine";

async function loadTaskOrThrow(taskId) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new HttpError(404, "Task not found");
  return task;
}

export const GET = withErrorHandling(async (_req, { params }) => {
  const session = requireAuth();
  const task = await loadTaskOrThrow(params.taskId);
  await requireProjectAccess(session, task.projectId);

  const full = await prisma.task.findUnique({
    where: { id: params.taskId },
    include: {
      project: { select: { id: true, key: true, name: true } },
      assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
      blockedBy: { include: { blockingTask: { select: { id: true, title: true, status: true } } } },
      blocks: { include: { task: { select: { id: true, title: true, status: true } } } },
    },
  });
  return NextResponse.json(full);
});

// PATCH — edit fields. Logs each changed field individually so the timeline (goal 9)
// shows exactly what changed, not just "task was updated."
export const PATCH = withErrorHandling(async (req, { params }) => {
  const session = requireAuth();
  const task = await loadTaskOrThrow(params.taskId);
  await requireProjectAccess(session, task.projectId);

  const body = await req.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
  const { blockingTaskIds, ...fields } = parsed.data;

  const changedFields = Object.entries(fields).filter(([key, value]) => task[key] !== value);

  const updateData = { ...fields };
  if ("dueDate" in fields) updateData.dueDateUpdatedAt = new Date(); // goal 10: alert must reappear on due-date change

  // Goal 3 requires blockers to be "other tasks in the same project" — reject cross-project
  // references explicitly rather than silently allowing them via a bare foreign key.
  let previousBlockerIds = [];
  if (blockingTaskIds) {
    const [blockerTasks, existingBlockers] = await Promise.all([
      prisma.task.findMany({ where: { id: { in: blockingTaskIds } }, select: { id: true, projectId: true } }),
      prisma.taskBlocker.findMany({ where: { taskId: params.taskId }, select: { blockingTaskId: true } }),
    ]);
    previousBlockerIds = existingBlockers.map((b) => b.blockingTaskId);

    const missing = blockingTaskIds.filter((id) => !blockerTasks.some((t) => t.id === id));
    if (missing.length) throw new HttpError(404, `Blocking task(s) not found: ${missing.join(", ")}`);

    const crossProject = blockerTasks.filter((t) => t.projectId !== task.projectId);
    if (crossProject.length) {
      throw new HttpError(422, "A task can only be blocked by other tasks in the same project");
    }
  }

  // STRETCH: cycle detection. Check every newly-added blocking edge against the rest of the
  // graph (excluding this task's own current edges, since those are about to be replaced)
  // before writing anything. One bad edge rejects the whole update with a clear reason.
  if (blockingTaskIds) {
    const otherEdges = (
      await prisma.taskBlocker.findMany({
        where: { taskId: { not: params.taskId } },
        select: { taskId: true, blockingTaskId: true },
      })
    ).map((e) => [e.taskId, e.blockingTaskId]);

    for (const blockingTaskId of blockingTaskIds) {
      if (wouldCreateCycle(otherEdges, params.taskId, blockingTaskId)) {
        throw new HttpError(
          422,
          `Cannot add "${blockingTaskId}" as a blocker — it would create a circular dependency`
        );
      }
      otherEdges.push([params.taskId, blockingTaskId]); // so later edges in the same request see this one too
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const t = await tx.task.update({ where: { id: params.taskId }, data: updateData });

    if (blockingTaskIds) {
      await tx.taskBlocker.deleteMany({ where: { taskId: params.taskId } });
      if (blockingTaskIds.length) {
        await tx.taskBlocker.createMany({
          data: blockingTaskIds.map((id) => ({ taskId: params.taskId, blockingTaskId: id })),
        });
      }
    }
    return t;
  });

  for (const [field, newValue] of changedFields) {
    await writeTaskEvent({
      taskId: params.taskId,
      userId: session.userId,
      type: "FIELD_CHANGE",
      field,
      oldValue: task[field],
      newValue,
    });
  }

  // Goal 9: blocker changes are a field change too — log them the same way, even though
  // they live in a join table rather than a column on Task, so the timeline shows a
  // complete picture of what changed, not just the scalar fields.
  if (blockingTaskIds) {
    const before = new Set(previousBlockerIds);
    const after = new Set(blockingTaskIds);
    const added = blockingTaskIds.filter((id) => !before.has(id));
    const removed = previousBlockerIds.filter((id) => !after.has(id));
    if (added.length || removed.length) {
      await writeTaskEvent({
        taskId: params.taskId,
        userId: session.userId,
        type: "FIELD_CHANGE",
        field: "blockedBy",
        oldValue: previousBlockerIds.join(", ") || null,
        newValue: blockingTaskIds.join(", ") || null,
      });
    }
  }

  return NextResponse.json(updated);
});

// DELETE — managers only (goal 1). The task's TaskEvent rows are removed via FK cascade;
// this is the one place deletion happens at all, and it's intentionally restricted.
export const DELETE = withErrorHandling(async (_req, { params }) => {
  const session = requireAuth();
  requireRole(session, "MANAGER");
  const task = await loadTaskOrThrow(params.taskId);
  await requireProjectAccess(session, task.projectId);

  await prisma.task.delete({ where: { id: params.taskId } });
  return NextResponse.json({ ok: true });
});
