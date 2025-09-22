import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Suspense } from "react"

import { ThemeProvider } from "@/components/theme-provider"
import ServiceWorkerRegistration from "@/components/service-worker-registration"
import { Toaster } from "@/components/ui/sonner"
import { LanguageProvider } from "@/components/language-provider"
import { SettingsProvider } from "@/components/settings-provider"
import { getUserLanguage } from "@/lib/i18n/server"
import { getAppSettings } from "@/lib/settings/service"
import "./globals.css"

export const metadata: Metadata = {
  title: "CashTrack - Personal Finance Manager",
  description: "Track your expenses, categorize transactions, and manage your budget with CashTrack",
  generator: "v0.app",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const language = getUserLanguage()
  const initialSettings = await getAppSettings()

  return (
    <html lang={language} suppressHydrationWarning>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <LanguageProvider initialLanguage={language}>
          <SettingsProvider initialSettings={initialSettings}>
            <Suspense fallback={null}>
              <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
                {children}
                <Toaster richColors position="top-right" />
                <ServiceWorkerRegistration />
              </ThemeProvider>
            </Suspense>
          </SettingsProvider>
        </LanguageProvider>
      </body>
    </html>
  )
}
