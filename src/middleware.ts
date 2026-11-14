import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  // the admin panel does not exist for anyone but a signed-in admin: plain "404 page not found",
  // so strangers and customers don't even learn there is something to attack
  if (pathname.startsWith("/admin") && session?.role !== "ADMIN") {
    // Server actions (POST) get a bare 404: Next forwards an action call to the page that owns the action
    // (here /admin/...), and a rewrite to the 404 page would receive the forwarded action and forward it again —
    // an endless loop that hung the request (a customer could wear the server down with forged calls).
    if (req.method !== "GET" && req.method !== "HEAD") return new NextResponse("Not found", { status: 404 });
    return NextResponse.rewrite(new URL("/__not_found", req.url), { status: 404 });
  }
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin")) {
    if (!session) {
      const url = new URL("/login", req.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (pathname.startsWith("/admin") && session.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    if (pathname.startsWith("/dashboard") && session.role === "ADMIN") {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
  }
  if ((pathname === "/login" || pathname === "/register") && session) {
    return NextResponse.redirect(new URL(session.role === "ADMIN" ? "/admin" : "/dashboard", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login", "/register"],
};
