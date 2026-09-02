import { NextResponse } from "next/server";

// Protect every dashboard route at the edge — redirect to /login if the session
// cookie is missing. Full JWT verification still happens inside each API route
// handler (src/lib/auth.js#getSessionFromCookies). This layer just prevents the
// dashboard shell from rendering at all for logged-out users, eliminating the
// client-side redirect flash that the useEffect in DashboardLayout used to cause.
export function middleware(request) {
  const session = request.cookies.get("session");
  if (!session?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

// Match every route that belongs to the (dashboard) group
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/tasks/:path*",
    "/projects/:path*",
    "/board/:path*",
    "/my-tasks/:path*",
    "/activity/:path*",
    "/alerts/:path*",
    "/digest/:path*",
  ],
};
