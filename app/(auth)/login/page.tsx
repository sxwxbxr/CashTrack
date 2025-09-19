"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

interface LoginResponse {
  user?: {
    username: string
    mustChangePassword: boolean
  }
  error?: unknown
}

function extractError(error: unknown): string {
  if (!error) return "Unable to sign in"
  if (typeof error === "string") return error
  if (error instanceof Error) return error.message
  if (typeof error === "object") {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string") {
      return message
    }
    const err = (error as { error?: unknown }).error
    if (err) {
      return extractError(err)
    }
  }
  return "Unable to sign in"
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") || "/"

  const [username, setUsername] = useState("household")
  const [password, setPassword] = useState("cashtrack")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })

      const body = (await response.json().catch(() => ({}))) as LoginResponse

      if (!response.ok || !body.user) {
        const message = extractError(body.error ?? "Invalid credentials")
        throw new Error(message)
      }

      toast.success("Welcome back", { description: body.user.username })
      if (body.user.mustChangePassword) {
        router.replace("/settings")
      } else {
        router.replace(redirectTo)
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to sign in"
      setError(message)
      toast.error("Sign in failed", { description: message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-md shadow-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">CashTrack Household Login</CardTitle>
          <CardDescription>Keep your finances private and synced across devices.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <Separator className="my-6" />

          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Default household credentials</p>
            <p>
              Username: <span className="font-mono">household</span>
              <br />
              Password: <span className="font-mono">cashtrack</span>
            </p>
            <p>Change the password from the Settings page after you sign in.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
