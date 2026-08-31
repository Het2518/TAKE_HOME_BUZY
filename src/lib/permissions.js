import { NextResponse } from "next/server";
import { getSessionFromCookies } from "./auth";
import { prisma } from "./prisma";

// Custom error carrying an HTTP status, so route handlers can catch it once
// and turn it into a JSON response without repeating status-code logic everywhere.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Every protected route calls this first. Throws 401 if not logged in.
export function requireAuth() {
  const session = getSessionFromCookies();
  if (!session) throw new HttpError(401, "Not authenticated");
  return session; // { userId, role }
}

// Throws 403 if the logged-in user's role isn't in the allowed list.
// This is the server-side enforcement goal 1 requires — the UI may hide buttons,
// but this is what actually blocks the action if someone calls the API directly.
export function requireRole(session, ...allowedRoles) {
  if (!allowedRoles.includes(session.role)) {
    throw new HttpError(403, `Requires role: ${allowedRoles.join(" or ")}`);
  }
}

// Throws 403 unless the user is a member of the given project (or a manager who owns it).
// Managers are NOT automatically members of every project — they must be added like anyone
// else, unless they own it. This mirrors "members can only see projects they belong to" (goal 1)
// while still letting a manager who created a project see it immediately.
export async function requireProjectAccess(session, projectId) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new HttpError(404, "Project not found");

  // Managers get portfolio-wide access (see GET /api/projects for the reasoning tied to
  // the brief's "see the whole portfolio at a glance" scenario) — no ownership/membership
  // check needed for a manager.
  if (session.role === "MANAGER") return project;

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: session.userId } },
  });
  if (!membership) throw new HttpError(403, "Not a member of this project");

  return project;
}

// Wraps a route handler so any HttpError thrown inside becomes a clean JSON error response,
// instead of every route repeating its own try/catch/status logic.
export function withErrorHandling(handler) {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      console.error(err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
