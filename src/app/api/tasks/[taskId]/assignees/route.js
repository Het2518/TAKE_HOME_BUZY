import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireProjectAccess, withErrorHandling, HttpError } from "@/lib/permissions";
import { writeTaskEvent } from "@/lib/auditLog";

// POST /api/tasks/:id/assignees  body: { userId }
// Only members of the task's project may be assigned (goal 5) — enforced here, not just in the UI.
export const POST = withErrorHandling(async (req, { params }) => {
  const session = requireAuth();
  const task = await prisma.task.findUnique({ where: { id: params.taskId } });
  if (!task) throw new HttpError(404, "Task not found");
  await requireProjectAccess(session, task.projectId);

  const { userId } = await req.json();
  if (!userId) throw new HttpError(400, "userId is required");

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: task.projectId, userId } },
  });
  if (!membership) throw new HttpError(422, "That user is not a member of this task's project");

  const assignment = await prisma.taskAssignee.upsert({
    where: { taskId_userId: { taskId: task.id, userId } },
    create: { taskId: task.id, userId },
    update: {},
  });

  await writeTaskEvent({
    taskId: task.id,
    userId: session.userId,
    type: "ASSIGNED",
    field: "assignee",
    newValue: userId,
  });

  return NextResponse.json(assignment, { status: 201 });
});

// DELETE /api/tasks/:id/assignees?userId=...
export const DELETE = withErrorHandling(async (req, { params }) => {
  const session = requireAuth();
  const task = await prisma.task.findUnique({ where: { id: params.taskId } });
  if (!task) throw new HttpError(404, "Task not found");
  await requireProjectAccess(session, task.projectId);

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) throw new HttpError(400, "userId query param is required");

  await prisma.taskAssignee.delete({
    where: { taskId_userId: { taskId: task.id, userId } },
  });

  await writeTaskEvent({
    taskId: task.id,
    userId: session.userId,
    type: "UNASSIGNED",
    field: "assignee",
    oldValue: userId,
  });

  return NextResponse.json({ ok: true });
});
