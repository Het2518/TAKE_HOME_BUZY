import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, withErrorHandling } from "@/lib/permissions";

function startOfWeek(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day; // Sunday as week start
  date.setHours(0, 0, 0, 0);
  return new Date(date.setDate(diff));
}

// GET /api/dashboard — all numbers computed server-side via aggregate queries (goal 8).
export const GET = withErrorHandling(async () => {
  const session = await requireAuth();

  const visibleProjectFilter =
    session.role === "MANAGER" ? {} : { members: { some: { userId: session.userId } } };
  const visibleProjects = await prisma.project.findMany({ where: visibleProjectFilter, select: { id: true } });
  const projectIds = visibleProjects.map((p) => p.id);

  const now = new Date();
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const eightWeeksAgo = new Date(weekStart);
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 7 * 7);

  const baseWhere = { projectId: { in: projectIds } };

  const [openCount, overdueCount, dueThisWeekCount, completedThisWeekCount, byStatus, byAssignee, recentDoneTasks] =
    await Promise.all([
      prisma.task.count({ where: { ...baseWhere, status: { not: "DONE" } } }),
      prisma.task.count({ where: { ...baseWhere, status: { not: "DONE" }, dueDate: { lt: now } } }),
      prisma.task.count({
        where: { ...baseWhere, dueDate: { gte: weekStart, lt: weekEnd }, status: { not: "DONE" } },
      }),
      prisma.task.count({
        where: { ...baseWhere, status: "DONE", updatedAt: { gte: weekStart, lt: weekEnd } },
      }),
      prisma.task.groupBy({ by: ["status"], where: baseWhere, _count: true }),
      prisma.taskAssignee.groupBy({
        by: ["userId"],
        where: { task: baseWhere },
        _count: true,
      }),
      // Fetch DONE tasks updated in the last 8 weeks, then bucket by week in JS —
      // simpler and more portable than a DB-specific date_trunc, acceptable at this data scale
      // (see docs/schema.md for what would need to change at 100x data).
      prisma.task.findMany({
        where: { ...baseWhere, status: "DONE", updatedAt: { gte: eightWeeksAgo } },
        select: { updatedAt: true },
      }),
    ]);

  const assigneeIds = byAssignee.map((a) => a.userId);
  const assigneeUsers = await prisma.user.findMany({
    where: { id: { in: assigneeIds } },
    select: { id: true, name: true },
  });
  const assigneeNameMap = Object.fromEntries(assigneeUsers.map((u) => [u.id, u.name]));

  const completionsByWeek = [];
  for (let i = 7; i >= 0; i--) {
    const bucketStart = new Date(weekStart);
    bucketStart.setDate(bucketStart.getDate() - i * 7);
    const bucketEnd = new Date(bucketStart);
    bucketEnd.setDate(bucketEnd.getDate() + 7);
    const count = recentDoneTasks.filter(
      (t) => t.updatedAt >= bucketStart && t.updatedAt < bucketEnd
    ).length;
    completionsByWeek.push({ weekStart: bucketStart.toISOString().slice(0, 10), count });
  }

  return NextResponse.json({
    headline: {
      open: openCount,
      overdue: overdueCount,
      dueThisWeek: dueThisWeekCount,
      completedThisWeek: completedThisWeekCount,
    },
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    byAssignee: byAssignee.map((a) => ({
      userId: a.userId,
      name: assigneeNameMap[a.userId] || "Unknown",
      count: a._count,
    })),
    completionsByWeek,
  });
});


