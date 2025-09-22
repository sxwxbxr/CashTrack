import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getIronSession } from "iron-session"

import { sessionOptions, type SessionData } from "@/lib/auth/session"

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/register",
  "/api/sync/pull",
  "/api/sync/push",
  "/api/sync/export",
  "/api/sync/import",
  "/sw.js",
  "/manifest.json",
  "/manifest.webmanifest",
]

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith("/_next/")) {
    return true
  }
  if (pathname.startsWith("/icons/")) {
    return true
  }
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

function isPasswordResetPath(request: NextRequest): boolean {
  const { pathname } = request.nextUrl
  if (pathname === "/settings") {
    return true
  }
  if (pathname.startsWith("/api/users/change-password")) {
    return true
  }
  if (pathname === "/api/settings" && ["GET", "HEAD"].includes(request.method)) {
    return true
  }
  if (pathname === "/api/auth/session" && ["GET", "HEAD"].includes(request.method)) {
    return true
  }
  return false
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const response = NextResponse.next()
  const session = await getIronSession<SessionData>(request, response, sessionOptions)
  const isApiRoute = pathname.startsWith("/api/")

  if (!session.user) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (session.user.mustChangePassword && !isPasswordResetPath(request)) {
    if (isApiRoute) {
      return NextResponse.json({ error: "Password change required" }, { status: 403 })
    }
    const settingsUrl = new URL("/settings", request.url)
    return NextResponse.redirect(settingsUrl)
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
