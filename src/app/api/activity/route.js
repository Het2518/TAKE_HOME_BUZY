import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, withErrorHandling } from "@/lib/permissions";

// STRETCH GOAL: activity feed across all projects the user can see. This is nearly free —
// it's the exact same TaskEvent table goal 9 already requires, just queried across every
// visible project instead of scoped to one task, with pagination. No new write path, no new
// table for the core feed (SavedFilter/board reuse existing endpoints too — see docs/decisions.md
// for why "reuse the audit log" was chosen over building a separate activity-tracking system).
export const GET = withErrorHandling(async (req) => {
  const session = await requireAuth();
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = 30;

  const visibleProjectFilter =
    session.role === "MANAGER" ? {} : { members: { some: { userId: session.userId } } };
  const visibleProjects = await prisma.project.findMany({ where: visibleProjectFilter, select: { id: true } });
  const projectIds = visibleProjects.map((p) => p.id);

  const where = { task: { projectId: { in: projectIds } } };

  const [total, events] = await Promise.all([
    prisma.taskEvent.count({ where }),
    prisma.taskEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, name: true } },
        task: { select: { id: true, title: true, project: { select: { key: true, name: true } } } },
      },
    }),
  ]);

  return NextResponse.json({ events, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
});


