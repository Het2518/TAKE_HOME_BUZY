import { prisma } from "@/lib/prisma";
import { requireAuth, withErrorHandling } from "@/lib/permissions";

function toCsvValue(val) {
  if (val == null) return "";
  const s = String(val).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

// GET /api/tasks/export — exports the CURRENT filtered list as CSV (goal 7).
// Accepts the same query params as GET /api/tasks so "export what I'm looking at" works.
export const GET = withErrorHandling(async (req) => {
  const session = await requireAuth();
  const { searchParams } = new URL(req.url);

  const search = searchParams.get("search") || "";
  const projectId = searchParams.get("projectId") || undefined;
  const status = searchParams.get("status") || undefined;
  const assigneeId = searchParams.get("assigneeId") || undefined;
  const priority = searchParams.get("priority") || undefined;
  const overdueOnly = searchParams.get("overdue") === "true";

  const visibleProjectFilter =
    session.role === "MANAGER" ? {} : { members: { some: { userId: session.userId } } };
  const visibleProjects = await prisma.project.findMany({ where: visibleProjectFilter, select: { id: true } });
  const visibleProjectIds = visibleProjects.map((p) => p.id);

  const where = {
    projectId: projectId ? projectId : { in: visibleProjectIds },
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(assigneeId ? { assignees: { some: { userId: assigneeId } } } : {}),
    ...(search
      ? { OR: [{ title: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }] }
      : {}),
    ...(overdueOnly ? { dueDate: { lt: new Date() }, status: { not: "DONE" } } : {}),
  };

  const tasks = await prisma.task.findMany({
    where,
    include: {
      project: { select: { key: true, name: true } },
      assignees: { include: { user: { select: { name: true, email: true } } } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const header = ["Project", "Title", "Status", "Priority", "Due Date", "Assignees", "Updated At"];
  const rows = tasks.map((t) => [
    t.project.key,
    t.title,
    t.status,
    t.priority,
    t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : "",
    t.assignees.map((a) => a.user.name).join("; "),
    new Date(t.updatedAt).toISOString(),
  ]);

  const csv = [header, ...rows].map((r) => r.map(toCsvValue).join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="tasks-export-${Date.now()}.csv"`,
    },
  });
});


