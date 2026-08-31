import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, withErrorHandling, HttpError } from "@/lib/permissions";

// GET /api/projects/:id/fields — list custom field definitions for a project
export const GET = withErrorHandling(async (_req, { params }) => {
  requireAuth();
  const fields = await prisma.customFieldDefinition.findMany({
    where: { projectId: params.projectId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(fields);
});

// POST /api/projects/:id/fields — create a custom field (manager only)
export const POST = withErrorHandling(async (req, { params }) => {
  const session = requireAuth();
  requireRole(session, "MANAGER");

  const { name, type, options } = await req.json();
  if (!name) throw new HttpError(400, "name is required");
  const validTypes = ["TEXT", "NUMBER", "DATE", "SELECT"];
  if (type && !validTypes.includes(type)) throw new HttpError(400, `type must be one of: ${validTypes.join(", ")}`);
  if (type === "SELECT" && (!options || !Array.isArray(options) || options.length === 0)) {
    throw new HttpError(400, "SELECT fields require a non-empty options array");
  }

  const field = await prisma.customFieldDefinition.create({
    data: {
      projectId: params.projectId,
      name,
      type: type || "TEXT",
      options: options ? JSON.stringify(options) : null,
    },
  });
  return NextResponse.json(field, { status: 201 });
});
