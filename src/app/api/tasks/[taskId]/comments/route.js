import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireProjectAccess, withErrorHandling, HttpError } from "@/lib/permissions";
import { commentSchema } from "@/lib/validators";
import { writeTaskEvent } from "@/lib/auditLog";

// GET /api/tasks/:id/comments — returns all COMMENT events on this task in
// chronological order. Comments are TaskEvent rows (type: COMMENT) so they live
// in the same immutable audit trail as every other field change (goal 9).
export const GET = withErrorHandling(async (_req, { params }) => {
  const session = requireAuth();
  const task = await prisma.task.findUnique({ where: { id: params.taskId } });
  if (!task) throw new HttpError(404, "Task not found");
  await requireProjectAccess(session, task.projectId);

  const comments = await prisma.taskEvent.findMany({
    where: { taskId: params.taskId, type: "COMMENT" },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(comments);
});

// POST /api/tasks/:id/comments — comments are TaskEvent rows (type: COMMENT), so they show
// up inline in the same immutable timeline as every other change (goal 9), not a bolted-on
// separate feature. There is no PATCH/DELETE here on purpose — comments cannot be edited or
// removed once posted, same as everything else in the timeline.
export const POST = withErrorHandling(async (req, { params }) => {
  const session = requireAuth();
  const task = await prisma.task.findUnique({ where: { id: params.taskId } });
  if (!task) throw new HttpError(404, "Task not found");
  await requireProjectAccess(session, task.projectId);

  const body = await req.json();
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "Comment text is required");

  const event = await writeTaskEvent({
    taskId: task.id,
    userId: session.userId,
    type: "COMMENT",
    commentText: parsed.data.text,
  });

  return NextResponse.json(event, { status: 201 });
});

