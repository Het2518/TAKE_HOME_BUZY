import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, withErrorHandling, HttpError } from "@/lib/permissions";
import { createProjectSchema } from "@/lib/validators";

// GET /api/projects — list projects visible to the current user.
// Managers see the WHOLE portfolio (the brief's scenario: "see the whole portfolio at a
// glance", "answer 'what is overdue' across the whole portfolio") — not just projects they
// own or are a member of. Members are the ones scoped to "only see projects they belong to"
// per goal 1 — that restriction is stated specifically for members, by contrast.
// Archived projects are excluded unless ?includeArchived=true.
export const GET = withErrorHandling(async (req) => {
  const session = await requireAuth();
  const { searchParams } = new URL(req.url);
  const includeArchived = searchParams.get("includeArchived") === "true";

  const visibility = session.role === "MANAGER" ? {} : { members: { some: { userId: session.userId } } };

  const projects = await prisma.project.findMany({
    where: {
      ...visibility,
      ...(includeArchived ? {} : { archived: false }),
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { tasks: true, members: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(projects);
});

// POST /api/projects — managers only.
export const POST = withErrorHandling(async (req) => {
  const session = await requireAuth();
  requireRole(session, "MANAGER");

  const body = await req.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0].message);

  const existing = await prisma.project.findUnique({ where: { key: parsed.data.key } });
  if (existing) throw new HttpError(409, "A project with that key already exists");

  // Both the owner and the creating manager must end up as members — otherwise a manager
  // who creates a project on someone else's behalf (owner != creator) would immediately
  // lose visibility into a project they just made, since GET /api/projects for managers
  // checks ownerId === self OR membership. Dedupe with a Set in case they're the same person.
  const memberIds = [...new Set([parsed.data.ownerId, session.userId])];

  const project = await prisma.project.create({
    data: {
      ...parsed.data,
      members: { create: memberIds.map((userId) => ({ userId })) },
    },
  });

  return NextResponse.json(project, { status: 201 });
});


