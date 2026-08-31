import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireProjectAccess, withErrorHandling, HttpError } from "@/lib/permissions";
import { commentSchema } from "@/lib/validators";
import { writeTaskEvent } from "@/lib/auditLog";

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
