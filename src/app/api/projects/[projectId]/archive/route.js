import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, withErrorHandling, HttpError } from "@/lib/permissions";

// PATCH /api/projects/:id/archive  body: { archived: true|false }
// Archiving hides the project from default views but never deletes tasks or history (goal 2).
export const PATCH = withErrorHandling(async (req, { params }) => {
  const session = await requireAuth();
  requireRole(session, "MANAGER");

  const { archived } = await req.json();
  if (typeof archived !== "boolean") throw new HttpError(400, "`archived` must be a boolean");

  const project = await prisma.project.update({
    where: { id: params.projectId },
    data: { archived },
  });
  return NextResponse.json(project);
});

