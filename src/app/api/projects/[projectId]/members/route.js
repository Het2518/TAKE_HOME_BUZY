import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, withErrorHandling, HttpError } from "@/lib/permissions";
import { writeTaskEvent } from "@/lib/auditLog";

// POST /api/projects/:id/members  body: { userId }  — managers only (goal 1)
export const POST = withErrorHandling(async (req, { params }) => {
  const session = await requireAuth();
  requireRole(session, "MANAGER");
  const { projectId } = await params;

  const { userId } = await req.json();
  if (!userId) throw new HttpError(400, "userId is required");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, "User not found");

  const membership = await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId, userId } },
    create: { projectId, userId },
    update: {},
  });

  return NextResponse.json(membership, { status: 201 });
});

// DELETE /api/projects/:id/members?userId=...
// Removing someone from a project unassigns them from that project's tasks (goal 5).
export const DELETE = withErrorHandling(async (req, { params }) => {
  const session = await requireAuth();
  requireRole(session, "MANAGER");
  const { projectId } = await params;

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) throw new HttpError(400, "userId query param is required");

  await prisma.$transaction(async (tx) => {
    // Find this user's assignments within this specific project's tasks.
    const assignments = await tx.taskAssignee.findMany({
      where: { userId, task: { projectId } },
    });

    for (const a of assignments) {
      await tx.taskAssignee.delete({ where: { id: a.id } });
      await writeTaskEvent({
        taskId: a.taskId,
        userId: session.userId,
        type: "UNASSIGNED",
        field: "assignee",
        oldValue: userId,
        newValue: null,
      }, tx);
    }

    await tx.projectMember.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  });

  return NextResponse.json({ ok: true });
});

