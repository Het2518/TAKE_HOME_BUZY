import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, withErrorHandling, HttpError } from "@/lib/permissions";

// POST /api/alerts/:taskId/dismiss
// A user may only dismiss an alert for a task THEY are assigned to (goal 10) —
// enforced here, not just by hiding the dismiss button for other people's tasks.
export const POST = withErrorHandling(async (_req, { params }) => {
  const session = requireAuth();

  const assignment = await prisma.taskAssignee.findUnique({
    where: { taskId_userId: { taskId: params.taskId, userId: session.userId } },
  });
  if (!assignment) throw new HttpError(403, "You can only dismiss alerts for tasks assigned to you");

  const dismissal = await prisma.alertDismissal.upsert({
    where: { taskId_userId: { taskId: params.taskId, userId: session.userId } },
    create: { taskId: params.taskId, userId: session.userId },
    update: { dismissedAt: new Date() }, // re-dismissing after it reappeared resets the clock
  });

  return NextResponse.json(dismissal);
});
