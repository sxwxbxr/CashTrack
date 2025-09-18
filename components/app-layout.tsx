import type React from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"

interface AppLayoutProps {
  children: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function AppLayout({ children, title, description, action }: AppLayoutProps) {
  return (
    <div className="border-t">
      <div className="bg-background">
        <div className="grid lg:grid-cols-5">
          <Sidebar className="hidden lg:block" />
          <div className="col-span-3 lg:col-span-4 lg:border-l">
            <Header title={title} description={description} action={action} />
            <div className="h-full px-4 py-6 lg:px-8">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
