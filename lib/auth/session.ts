import { cookies } from "next/headers"
import type { IronSession, IronSessionOptions } from "iron-session"
import { getIronSession } from "iron-session"

const SESSION_COOKIE_NAME = "cashtrack-session"
const DEV_SESSION_SECRET = "cashtrack-dev-secret-please-set-env"

let cachedSessionSecret: string | undefined

function getSessionSecret(): string {
  if (cachedSessionSecret) {
    return cachedSessionSecret
  }

  const secret = process.env.CASHTRACK_SESSION_SECRET
  if (secret && secret.length >= 16) {
    cachedSessionSecret = secret
    return secret
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "CASHTRACK_SESSION_SECRET is not set; falling back to an insecure development secret. " +
        "Copy .env.example to .env.local and configure a long random value.",
    )
    cachedSessionSecret = DEV_SESSION_SECRET
    return DEV_SESSION_SECRET
  }

  throw new Error("CASHTRACK_SESSION_SECRET must be set to a secure value")
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
