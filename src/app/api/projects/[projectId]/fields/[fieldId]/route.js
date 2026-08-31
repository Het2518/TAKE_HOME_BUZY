import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, withErrorHandling, HttpError } from "@/lib/permissions";

// DELETE /api/projects/:id/fields/:fieldId — remove a custom field + all its values
export const DELETE = withErrorHandling(async (_req, { params }) => {
  const session = requireAuth();
  requireRole(session, "MANAGER");

  const field = await prisma.customFieldDefinition.findUnique({ where: { id: params.fieldId } });
  if (!field) throw new HttpError(404, "Custom field not found");
  if (field.projectId !== params.projectId) throw new HttpError(403, "Field does not belong to this project");

  await prisma.customFieldDefinition.delete({ where: { id: params.fieldId } });
  return NextResponse.json({ ok: true });
});
