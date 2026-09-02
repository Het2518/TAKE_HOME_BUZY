import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireProjectAccess, withErrorHandling, HttpError } from "@/lib/permissions";
import { createTaskSchema } from "@/lib/validators";
import { writeTaskEvent } from "@/lib/auditLog";
import { wouldCreateCycle } from "@/lib/taskStateMachine";

// GET /api/tasks — unified cross-project search/filter/sort/pagination (goal 6).
// Every bit of this happens in the database query, never by loading everything and
// filtering in the browser — see docs/decisions.md.
export const GET = withErrorHandling(async (req) => {
  const session = await requireAuth();
  const { searchParams } = new URL(req.url);

  const search = searchParams.get("search") || "";
  const projectId = searchParams.get("projectId") || undefined;
  const status = searchParams.get("status") || undefined;
  const assigneeId = searchParams.get("assigneeId") || undefined;
  const priority = searchParams.get("priority") || undefined;
  const overdueOnly = searchParams.get("overdue") === "true";
  const sortBy = searchParams.get("sortBy") || "updatedAt"; // dueDate | priority | updatedAt
  const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

  // Visibility: which projects can this user see at all?
  // Managers get portfolio-wide visibility (see src/lib/permissions.js requireProjectAccess
  // for the same reasoning) — members stay scoped to projects they belong to.
  const visibleProjectFilter =
    session.role === "MANAGER" ? {} : { members: { some: { userId: session.userId } } };
  const visibleProjects = await prisma.project.findMany({
    where: visibleProjectFilter,
    select: { id: true },
  });
  const visibleProjectIds = visibleProjects.map((p) => p.id);

  const where = {
    projectId: projectId ? projectId : { in: visibleProjectIds },
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(assigneeId ? { assignees: { some: { userId: assigneeId } } } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(overdueOnly
      ? { dueDate: { lt: new Date() }, status: { not: "DONE" } }
      : {}),
  };

  const orderBy =
    sortBy === "priority"
      ? { priority: sortDir }
      : sortBy === "dueDate"
      ? { dueDate: sortDir }
      : { updatedAt: sortDir };

  const [total, tasks] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        project: { select: { id: true, key: true, name: true } },
        assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
        blockedBy: { include: { blockingTask: { select: { id: true, title: true, status: true } } } },
      },
    }),
  ]);

  return NextResponse.json({
    tasks,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

// POST /api/tasks — create a task. Any project member may create (goal 3).
export const POST = withErrorHandling(async (req) => {
  const session = await requireAuth();
  const body = await req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);

  await requireProjectAccess(session, parsed.data.projectId);

  const { blockingTaskIds, ...taskData } = parsed.data;

  // Goal 3: blockers must be other tasks in the same project. On creation this is simpler
  // than on update (no cycle risk — see note below) but the same-project check still applies.
  if (blockingTaskIds.length) {
    const blockerTasks = await prisma.task.findMany({
      where: { id: { in: blockingTaskIds } },
      select: { id: true, projectId: true },
    });
    const missing = blockingTaskIds.filter((id) => !blockerTasks.some((t) => t.id === id));
    if (missing.length) throw new HttpError(404, `Blocking task(s) not found: ${missing.join(", ")}`);
    const crossProject = blockerTasks.filter((t) => t.projectId !== taskData.projectId);
    if (crossProject.length) {
      throw new HttpError(422, "A task can only be blocked by other tasks in the same project");
    }
  }

  // Note: a brand-new task cannot already appear as an existing blocker anywhere in the
  // graph (its id doesn't exist yet until the insert below), so no cycle is possible at
  // creation time — cycle detection only needs to run on updates. See
  // src/app/api/tasks/[taskId]/route.js PATCH handler for the real enforcement point,
  // and src/lib/taskStateMachine.js#wouldCreateCycle for the algorithm (DFS over the
  // "what depends on this task" graph).

  const task = await prisma.task.create({
    data: {
      ...taskData,
      dueDateUpdatedAt: taskData.dueDate ? new Date() : null,
      blockedBy: blockingTaskIds.length
        ? { create: blockingTaskIds.map((id) => ({ blockingTaskId: id })) }
        : undefined,
    },
  });

  await writeTaskEvent({ taskId: task.id, userId: session.userId, type: "CREATED" });

  return NextResponse.json(task, { status: 201 });
});


