import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/health — no auth required. Used by load balancers, uptime monitors,
// and deployment pipelines to confirm the app + DB are reachable.
// Returns 200 on success, 503 if the DB is unreachable.
export const GET = async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      db: "ok",
      uptime: Math.floor(process.uptime()),
    });
  } catch {
    // Don't expose the raw DB error — just signal that something is down.
    return NextResponse.json({ ok: false, db: "error" }, { status: 503 });
  }
};
