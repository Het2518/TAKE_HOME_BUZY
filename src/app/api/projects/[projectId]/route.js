import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  requireRole,
  requireProjectAccess,
  withErrorHandling,
  HttpError,
} from "@/lib/permissions";
import { updateProjectSchema } from "@/lib/validators";

export const GET = withErrorHandling(async (_req, { params }) => {
  const session = requireAuth();
  await requireProjectAccess(session, params.projectId);

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  if (!project) throw new HttpError(404, "Project not found");
  return NextResponse.json(project);
});

// PATCH — edit project fields. Managers only.
export const PATCH = withErrorHandling(async (req, { params }) => {
  const session = requireAuth();
  requireRole(session, "MANAGER");
  await requireProjectAccess(session, params.projectId);

  const body = await req.json();
  const parsed = updateProjectSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);

  const project = await prisma.project.update({
    where: { id: params.projectId },
    data: parsed.data,
  });
  return NextResponse.json(project);
});

// DELETE is not supported — projects are archived, never destroyed. See goal 2 / docs/decisions.md.
// PATCH .../archive and .../restore below handle the archive toggle instead.
