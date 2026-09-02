import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, withErrorHandling, HttpError } from "@/lib/permissions";

export const DELETE = withErrorHandling(async (_req, { params }) => {
  const session = await requireAuth();
  const filter = await prisma.savedFilter.findUnique({ where: { id: params.filterId } });
  if (!filter) throw new HttpError(404, "Saved filter not found");
  if (filter.userId !== session.userId) throw new HttpError(403, "Not your saved filter");

  await prisma.savedFilter.delete({ where: { id: params.filterId } });
  return NextResponse.json({ ok: true });
});

