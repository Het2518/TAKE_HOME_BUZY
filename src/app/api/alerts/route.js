import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, withErrorHandling } from "@/lib/permissions";

// GET /api/alerts — overdue, not-Done tasks assigned to the current user, excluding
// ones they've already dismissed FOR THE CURRENT due date (goal 10).
// If the due date changed after a dismissal, the alert must reappear — implemented by
// comparing dismissedAt to dueDateUpdatedAt rather than just checking "is it dismissed."
export const GET = withErrorHandling(async () => {
  const session = await requireAuth();
  const now = new Date();

  const candidateTasks = await prisma.task.findMany({
    where: {
      status: { not: "DONE" },
      dueDate: { lt: now },
      assignees: { some: { userId: session.userId } },
    },
    include: {
      project: { select: { id: true, key: true, name: true } },
      dismissals: { where: { userId: session.userId } },
    },
    orderBy: { dueDate: "asc" },
  });

  const active = candidateTasks.filter((t) => {
    const dismissal = t.dismissals[0];
    if (!dismissal) return true; // never dismissed -> active
    // Reappear if the due date was changed after the dismissal was recorded.
    if (t.dueDateUpdatedAt && t.dueDateUpdatedAt > dismissal.dismissedAt) return true;
    return false;
  });

  return NextResponse.json({
    count: active.length,
    alerts: active.map(({ dismissals, ...t }) => t),
  });
});


