import { cookies } from "next/headers"
import type { IronSession, IronSessionOptions } from "iron-session"
import { getIronSession } from "iron-session"

const SESSION_COOKIE_NAME = "cashtrack-session"

function getSessionSecret(): string {
  const secret = process.env.CASHTRACK_SESSION_SECRET
  if (!secret || secret.length < 16) {
    throw new Error("CASHTRACK_SESSION_SECRET must be set to a secure value")
  }
  return secret
}

export interface SessionUser {
  id: string
  username: string
  mustChangePassword: boolean
}

export interface SessionData {
  user?: SessionUser
}

export const sessionOptions: IronSessionOptions = {
  cookieName: SESSION_COOKIE_NAME,
  password: getSessionSecret(),
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
}

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(cookies(), sessionOptions)
}

export class AuthenticationError extends Error {
  status = 401
  constructor(message = "Unauthorized") {
    super(message)
    this.name = "AuthenticationError"
  }
}

export class PasswordChangeRequiredError extends Error {
  status = 403
  constructor(message = "Password change required") {
    super(message)
    this.name = "PasswordChangeRequiredError"
  }
}

export interface RequireSessionOptions {
  allowPasswordReset?: boolean
}

export async function requireSession(options: RequireSessionOptions = {}): Promise<IronSession<SessionData>> {
  const session = await getSession()
  if (!session.user) {
    throw new AuthenticationError()
  }

  if (session.user.mustChangePassword && !options.allowPasswordReset) {
    throw new PasswordChangeRequiredError()
  }

  return session
}
