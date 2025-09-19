"use client"

import { useEffect } from "react"
import { toast } from "sonner"

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return
    }

    let registration: ServiceWorkerRegistration | null = null
    let mounted = true

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js")
        if (!registration) {
          return
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration?.installing
          if (!installing) return
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              toast.info("CashTrack update ready", {
                description: "Reload to use the latest offline features.",
                action: {
                  label: "Reload",
                  onClick: () => window.location.reload(),
                },
              })
            }
          })
        })
      } catch (error) {
        if (mounted) {
          console.error("Service worker registration failed", error)
        }
      }
    }

    register()

    return () => {
      mounted = false
      registration = null
    }
  }, [])

  return null
}

export default ServiceWorkerRegistration
