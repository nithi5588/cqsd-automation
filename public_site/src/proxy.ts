import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Prefix-matched: `/register` covers `/register/<slug>` for the public webinar page. */
const PUBLIC_PREFIXES = ["/login", "/register"];
const SESSION_COOKIE = "cqsd_session";

/**
 * Cookie-presence gate only: the JWT never reaches the proxy, and roles are
 * enforced client-side by RoleGuard/canAccess. `cqsd_session=1` is set by the
 * AuthProvider on login and cleared on logout.
 */
export function proxy(req: NextRequest) {
	const { pathname } = req.nextUrl;
	const hasSession = req.cookies.get(SESSION_COOKIE)?.value === "1";
	const isPublic = PUBLIC_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
	);

	if (!hasSession) {
		if (isPublic) return NextResponse.next();
		const url = req.nextUrl.clone();
		url.pathname = "/login";
		url.search = "";
		url.searchParams.set("next", pathname);
		return NextResponse.redirect(url);
	}

	// signed in → keep them out of /login (but /register stays reachable for everyone)
	if (pathname === "/login") {
		const next = req.nextUrl.searchParams.get("next");
		const url = req.nextUrl.clone();
		url.pathname = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
		url.search = "";
		return NextResponse.redirect(url);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
