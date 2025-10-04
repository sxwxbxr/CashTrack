"use client"

import type React from "react"
import Link from "next/link"
import { useEffect, useState } from "react"

import type { SessionUser } from "@/lib/auth/session"
import { MobileSidebar } from "@/components/sidebar"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useTranslations } from "@/components/language-provider"

interface HeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export function Header({ title, description, action }: HeaderProps) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const { t } = useTranslations()

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" })
        if (!response.ok) {
          setUser(null)
          return
        }
        const body = (await response.json()) as { user?: SessionUser }
        if (!cancelled) {
          setUser(body.user ?? null)
        }
      } catch {
        if (!cancelled) {
          setUser(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    window.location.href = "/login"
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <MobileSidebar />
        <div className="mr-4 hidden md:flex">
          <div className="mr-6 flex items-center space-x-2">
            <span className="hidden font-bold sm:inline-block">{title}</span>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            {description && <p className="text-sm text-muted-foreground md:hidden">{description}</p>}
          </div>
          <nav className="flex items-center space-x-2">
            {action}
            {!loading && user ? (
              <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                <span className="hidden md:inline">{t("Signed in as")}</span>
                <span className="font-medium text-foreground">{user.username}</span>
                <Separator orientation="vertical" className="hidden md:block h-6" />
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  {t("Logout")}
                </Button>
              </div>
            ) : !loading ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/login">{t("Sign in")}</Link>
              </Button>
            ) : null}
            <LanguageSwitcher className="sm:hidden" />
            <LanguageSwitcher className="hidden sm:flex" />
            <ModeToggle />
          </nav>
        </div>
      </div>
    </header>
  )
}
