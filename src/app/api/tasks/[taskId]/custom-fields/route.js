import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireProjectAccess, withErrorHandling, HttpError } from "@/lib/permissions";

// GET /api/tasks/:id/custom-fields — get all custom field values for a task
export const GET = withErrorHandling(async (_req, { params }) => {
  const session = await requireAuth();
  const task = await prisma.task.findUnique({ where: { id: params.taskId } });
  if (!task) throw new HttpError(404, "Task not found");
  await requireProjectAccess(session, task.projectId);

  // Get all field definitions for the project + the task's values for each
  const [definitions, values] = await Promise.all([
    prisma.customFieldDefinition.findMany({
      where: { projectId: task.projectId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.customFieldValue.findMany({
      where: { taskId: params.taskId },
    }),
  ]);

  const valueMap = Object.fromEntries(values.map((v) => [v.fieldId, v.value]));
  const fields = definitions.map((d) => ({
    ...d,
    options: d.options ? JSON.parse(d.options) : null,
    value: valueMap[d.id] ?? "",
  }));

  return NextResponse.json(fields);
});

// PATCH /api/tasks/:id/custom-fields — set custom field values { fieldId: value, ... }
export const PATCH = withErrorHandling(async (req, { params }) => {
  const session = await requireAuth();
  const task = await prisma.task.findUnique({ where: { id: params.taskId } });
  if (!task) throw new HttpError(404, "Task not found");
  await requireProjectAccess(session, task.projectId);

  const updates = await req.json(); // { [fieldId]: value }
  if (typeof updates !== "object" || Array.isArray(updates)) {
    throw new HttpError(400, "Body must be an object of { fieldId: value }");
  }

  for (const [fieldId, value] of Object.entries(updates)) {
    await prisma.customFieldValue.upsert({
      where: { taskId_fieldId: { taskId: params.taskId, fieldId } },
      create: { taskId: params.taskId, fieldId, value: String(value) },
      update: { value: String(value) },
    });
  }

  return NextResponse.json({ ok: true });
});

