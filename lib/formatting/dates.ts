import type { DateFormat } from "@/lib/settings/types"

const DAY_IN_MS = 86_400_000

function toDate(value: Date | string): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === "string" && value) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
    const isoFallback = new Date(`${value}T00:00:00`)
    return Number.isNaN(isoFallback.getTime()) ? null : isoFallback
  }
  return null
}

function pad(value: number): string {
  return value.toString().padStart(2, "0")
}

export function formatDateWithPattern(
  input: Date | string,
  format: DateFormat,
  locale?: string,
): string {
  const date = toDate(input)
  if (!date) {
    return ""
  }

  const year = date.getFullYear()
  const monthIndex = date.getMonth() + 1
  const day = date.getDate()
  const localeOption = locale ? [locale] : undefined

  switch (format) {
    case "MM/DD/YYYY":
      return `${pad(monthIndex)}/${pad(day)}/${year}`
    case "DD/MM/YYYY":
      return `${pad(day)}/${pad(monthIndex)}/${year}`
    case "YYYY-MM-DD":
      return `${year}-${pad(monthIndex)}-${pad(day)}`
    case "DD MMM YYYY": {
      const monthName = date.toLocaleString(localeOption, { month: "short" })
      return `${pad(day)} ${monthName} ${year}`
    }
    case "MMM DD, YYYY": {
      const monthName = date.toLocaleString(localeOption, { month: "short" })
      return `${monthName} ${pad(day)}, ${year}`
    }
    default:
      return date.toLocaleDateString(localeOption)
  }
}

export function formatDateRange(
  start: string,
  end: string,
  format: DateFormat,
  locale?: string,
): string {
  const startDate = toDate(start)
  const endDate = toDate(end)
  if (!startDate || !endDate) {
    return `${start} – ${end}`
  }

  const inclusiveEnd = new Date(endDate.getTime() - DAY_IN_MS)
  return `${formatDateWithPattern(startDate, format, locale)} – ${formatDateWithPattern(inclusiveEnd, format, locale)}`
}
