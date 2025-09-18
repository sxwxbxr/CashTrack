"use client"

import type React from "react"

import { MobileSidebar } from "@/components/sidebar"
import { ModeToggle } from "@/components/mode-toggle"

interface HeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export function Header({ title, description, action }: HeaderProps) {
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
            <ModeToggle />
          </nav>
        </div>
      </div>
    </header>
  )
}
