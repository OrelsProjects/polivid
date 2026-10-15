import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth gate (Next 16 "proxy", formerly middleware).
 *
 * It only checks that a session cookie exists, with no database call, so it
 * stays cheap on every request and prefetch. The real check happens close to
 * the data in lib/session.ts (getCurrentUser) and in each API route.
 */
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function proxy(request: NextRequest) {
  const signedIn = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (signedIn) return NextResponse.next();

  const login = new URL("/login", request.url);
  login.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/dashboard/:path*", "/create/:path*", "/videos/:path*", "/editor/:path*"],
};
