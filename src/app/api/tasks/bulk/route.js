import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireProjectAccess, withErrorHandling, HttpError } from "@/lib/permissions";
import { bulkActionSchema } from "@/lib/validators";
import { validateTransition } from "@/lib/taskStateMachine";
import { writeTaskEvent } from "@/lib/auditLog";

// POST /api/tasks/bulk  body: { taskIds, action, value }
// Requirement (goal 7): one illegal task must NOT fail the whole batch — every task is
// processed independently and the response reports per-task success/failure with a reason.
export const POST = withErrorHandling(async (req) => {
  const session = await requireAuth();
  const body = await req.json();
  const parsed = bulkActionSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);
  const { taskIds, action, value } = parsed.data;

  const results = [];

  for (const taskId of taskIds) {
    try {
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      if (!task) {
        results.push({ taskId, success: false, message: "Task not found" });
        continue;
      }

      // Access check per task — a bulk request could span tasks from projects the user
      // doesn't belong to, and each one must be checked individually, not just the first.
      try {
        await requireProjectAccess(session, task.projectId);
      } catch {
        results.push({ taskId, success: false, message: "Not authorized for this task's project" });
        continue;
      }

      if (action === "STATUS") {
        const blockers = await prisma.taskBlocker.findMany({
          where: { taskId },
          include: { blockingTask: { select: { status: true } } },
        });
        const hasIncompleteBlockers = blockers.some((b) => b.blockingTask.status !== "DONE");
        const check = validateTransition(task.status, value, hasIncompleteBlockers, task.blockedFromStatus);
        if (!check.ok) {
          results.push({ taskId, success: false, message: check.reason });
          continue;
        }
        await prisma.task.update({ where: { id: taskId }, data: { status: check.resolvedStatus } });
        await writeTaskEvent({
          taskId,
          userId: session.userId,
          type: "STATUS_CHANGE",
          field: "status",
          oldValue: task.status,
          newValue: check.resolvedStatus,
        });
      } else if (action === "ASSIGNEE") {
        const membership = await prisma.projectMember.findUnique({
          where: { projectId_userId: { projectId: task.projectId, userId: value } },
        });
        if (!membership) {
          results.push({ taskId, success: false, message: "User is not a member of this project" });
          continue;
        }
        await prisma.taskAssignee.upsert({
          where: { taskId_userId: { taskId, userId: value } },
          create: { taskId, userId: value },
          update: {},
        });
        await writeTaskEvent({ taskId, userId: session.userId, type: "ASSIGNED", field: "assignee", newValue: value });
      } else if (action === "DUE_DATE") {
        await prisma.task.update({
          where: { id: taskId },
          data: { dueDate: new Date(value), dueDateUpdatedAt: new Date() },
        });
        await writeTaskEvent({
          taskId,
          userId: session.userId,
          type: "FIELD_CHANGE",
          field: "dueDate",
          oldValue: task.dueDate,
          newValue: value,
        });
      }

      results.push({ taskId, success: true, message: "Updated" });
    } catch (err) {
      results.push({ taskId, success: false, message: err.message || "Unexpected error" });
    }
  }

  return NextResponse.json({ results });
});


