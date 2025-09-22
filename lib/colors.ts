const TAILWIND_BG_COLOR_MAP: Record<string, string> = {
  "bg-slate-500": "#64748b",
  "bg-gray-500": "#6b7280",
  "bg-zinc-500": "#71717a",
  "bg-neutral-500": "#737373",
  "bg-stone-500": "#78716c",
  "bg-red-500": "#ef4444",
  "bg-orange-500": "#f97316",
  "bg-amber-500": "#f59e0b",
  "bg-yellow-500": "#eab308",
  "bg-lime-500": "#84cc16",
  "bg-green-500": "#22c55e",
  "bg-emerald-500": "#10b981",
  "bg-teal-500": "#14b8a6",
  "bg-cyan-500": "#06b6d4",
  "bg-sky-500": "#0ea5e9",
  "bg-blue-500": "#3b82f6",
  "bg-indigo-500": "#6366f1",
  "bg-violet-500": "#8b5cf6",
  "bg-purple-500": "#a855f7",
  "bg-fuchsia-500": "#d946ef",
  "bg-pink-500": "#ec4899",
  "bg-rose-500": "#f43f5e",
}

export function tailwindBgClassToHex(colorClass: string | null | undefined, fallback = "#64748b"): string {
  if (!colorClass) {
    return fallback
  }

  const direct = TAILWIND_BG_COLOR_MAP[colorClass]
  if (direct) {
    return direct
  }

  const normalized = colorClass.trim().toLowerCase()
  return TAILWIND_BG_COLOR_MAP[normalized] ?? fallback
}

export const DEFAULT_CHART_COLORS = [
  "#6366F1",
  "#22C55E",
  "#F97316",
  "#0EA5E9",
  "#EC4899",
  "#FACC15",
]
