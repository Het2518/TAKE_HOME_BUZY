import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireProjectAccess, withErrorHandling, HttpError } from "@/lib/permissions";
import { statusChangeSchema } from "@/lib/validators";
import { validateTransition } from "@/lib/taskStateMachine";
import { writeTaskEvent } from "@/lib/auditLog";

// PATCH /api/tasks/:id/status  body: { targetStatus }
// This is THE enforcement point for goal 4. The frontend should only ever render legal
// moves (via getLegalTransitions), but this route re-validates from scratch regardless —
// a direct API call with an illegal target must still be rejected with a clear reason.
export const PATCH = withErrorHandling(async (req, { params }) => {
  const session = await requireAuth();
  const { taskId } = await params;

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new HttpError(404, "Task not found");
  await requireProjectAccess(session, task.projectId);

  const body = await req.json();
  const parsed = statusChangeSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "targetStatus is required and must be valid");

  // Does this task have any blocker that isn't Done yet?
  const blockers = await prisma.taskBlocker.findMany({
    where: { taskId: task.id },
    include: { blockingTask: { select: { status: true } } },
  });
  const hasIncompleteBlockers = blockers.some((b) => b.blockingTask.status !== "DONE");

  const result = validateTransition(
    task.status,
    parsed.data.targetStatus,
    hasIncompleteBlockers,
    task.blockedFromStatus
  );

  if (!result.ok) {
    // Explicit rejection with a message explaining why — required by goal 4.
    throw new HttpError(422, result.reason);
  }

  const updateData = { status: result.resolvedStatus };
  if (result.blockedFromStatus) {
    updateData.blockedFromStatus = result.blockedFromStatus; // entering BLOCKED: remember where from
  } else if (task.status === "BLOCKED") {
    updateData.blockedFromStatus = null; // leaving BLOCKED: clear it
  }

  const updated = await prisma.task.update({ where: { id: task.id }, data: updateData });

  await writeTaskEvent({
    taskId: task.id,
    userId: session.userId,
    type: "STATUS_CHANGE",
    field: "status",
    oldValue: task.status,
    newValue: result.resolvedStatus,
  });

  return NextResponse.json(updated);
});

