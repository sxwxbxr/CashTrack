import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

import type { AccountSummary, ReportAnalytics, SummaryMetric } from "@/lib/reports/analytics"

const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const PAGE_MARGIN = 40
const TEXT_COLOR = rgb(0.2, 0.24, 0.3)
const MUTED_COLOR = rgb(0.45, 0.5, 0.58)
const HEADER_COLOR = rgb(0.14, 0.2, 0.35)
const POSITIVE_COLOR = rgb(0.13, 0.5, 0.35)
const NEGATIVE_COLOR = rgb(0.7, 0.26, 0.26)
const DIVIDER_COLOR = rgb(0.82, 0.86, 0.92)

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

const preciseCurrencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
})

const integerFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })

function formatCurrency(value: number, precise = false) {
  return precise ? preciseCurrencyFormatter.format(value) : currencyFormatter.format(value)
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "—"
  }
  const rounded = value.toFixed(1)
  return `${value > 0 ? "+" : ""}${rounded}%`
}

function parseIsoDate(value: string): Date | null {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function formatDateRange(start: string, end: string) {
  const startDate = parseIsoDate(start)
  const endDate = parseIsoDate(end)
  if (!startDate || !endDate) {
    return `${start} – ${end}`
  }

  const inclusiveEnd = new Date(endDate.getTime() - 86_400_000)
  const formatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  return `${formatter.format(startDate)} – ${formatter.format(inclusiveEnd)}`
}

function normalizeHex(hex: string) {
  const cleaned = hex.replace("#", "").trim()
  return cleaned.length === 3
    ? cleaned
        .split("")
        .map((char) => `${char}${char}`)
        .join("")
    : cleaned.padStart(6, "0")
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex)
  const value = Number.parseInt(normalized, 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return rgb(r / 255, g / 255, b / 255)
}

function wrapText(text: string, font: any, size: number, maxWidth: number) {
  if (!text) return [""]
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const tentative = current ? `${current} ${word}` : word
    const width = font.widthOfTextAtSize(tentative, size)
    if (width <= maxWidth || !current) {
      current = tentative
      continue
    }

    lines.push(current)
    current = word
  }

  if (current) {
    lines.push(current)
  }

  return lines
}
export async function buildReportPdf(report: ReportAnalytics): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const [regularFont, boldFont, italicFont] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
    doc.embedFont(StandardFonts.HelveticaOblique),
  ])

  const pageSize: [number, number] = [PAGE_WIDTH, PAGE_HEIGHT]
  let page = doc.addPage(pageSize)
  let cursorY = page.getHeight() - PAGE_MARGIN

  const startNewPage = () => {
    page = doc.addPage(pageSize)
    cursorY = page.getHeight() - PAGE_MARGIN
  }

  const ensureSpace = (height: number) => {
    if (cursorY - height < PAGE_MARGIN) {
      startNewPage()
    }
  }

  const drawSpacer = (space: number) => {
    ensureSpace(space)
    cursorY -= space
  }

  const drawTextLine = (
    text: string,
    {
      size = 12,
      font = regularFont,
      color = TEXT_COLOR,
      lineHeight = size + 6,
      x = PAGE_MARGIN,
    }: { size?: number; font?: any; color?: ReturnType<typeof rgb>; lineHeight?: number; x?: number } = {},
  ) => {
    ensureSpace(lineHeight)
    const baseline = cursorY - size
    page.drawText(text, {
      x,
      y: baseline,
      size,
      font,
      color,
    })
    cursorY -= lineHeight
  }

  const drawDivider = () => {
    ensureSpace(12)
    const y = cursorY - 8
    page.drawRectangle({
      x: PAGE_MARGIN,
      y,
      width: page.getWidth() - PAGE_MARGIN * 2,
      height: 1,
      color: DIVIDER_COLOR,
    })
    cursorY -= 12
  }

  const drawSectionHeading = (title: string, subtitle?: string) => {
    drawTextLine(title, { font: boldFont, size: 14, lineHeight: 22, color: HEADER_COLOR })
    if (subtitle) {
      drawTextLine(subtitle, { size: 11, lineHeight: 16, color: MUTED_COLOR })
    }
  }

  const drawSummaryCards = (metrics: SummaryMetric[]) => {
    if (metrics.length === 0) {
      return
    }

    const columns = 2
    const gap = 14
    const cardWidth = (page.getWidth() - PAGE_MARGIN * 2 - gap * (columns - 1)) / columns
    const cardHeight = 72

    metrics.forEach((metric, index) => {
      const column = index % columns
      if (column === 0) {
        ensureSpace(cardHeight + (index === 0 ? 0 : gap))
        if (index !== 0) {
          cursorY -= gap
        }
      }

      const top = cursorY
      const bottom = top - cardHeight
      const x = PAGE_MARGIN + column * (cardWidth + gap)

      page.drawRectangle({
        x,
        y: bottom,
        width: cardWidth,
        height: cardHeight,
        color: rgb(0.95, 0.97, 1),
        borderColor: rgb(0.82, 0.88, 0.97),
        borderWidth: 1,
      })

      page.drawText(metric.label, {
        x: x + 12,
        y: top - 20,
        size: 11,
        font: boldFont,
        color: HEADER_COLOR,
      })

      page.drawText(formatCurrency(metric.value, true), {
        x: x + 12,
        y: top - 38,
        size: 16,
        font: boldFont,
        color: TEXT_COLOR,
      })

      if (metric.helper) {
        page.drawText(metric.helper, {
          x: x + 12,
          y: top - 54,
          size: 9,
          font: italicFont,
          color: MUTED_COLOR,
        })
      }

      const changeText = metric.change === null ? "No comparison" : formatPercent(metric.change)
      const changeColor = metric.change === null ? MUTED_COLOR : metric.change >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR
      page.drawText(changeText, {
        x: x + 12,
        y: bottom + 14,
        size: 10,
        font: regularFont,
        color: changeColor,
      })

      if (column === columns - 1 || index === metrics.length - 1) {
        cursorY = bottom
      }
    })
  }
  const drawBulletList = (items: string[], options?: { bullet?: string }) => {
    if (items.length === 0) {
      drawTextLine("No highlights available yet.", { size: 11, color: MUTED_COLOR })
      return
    }

    const bullet = options?.bullet ?? "•"
    const fontSize = 11
    const lineHeight = fontSize + 6
    const bulletX = PAGE_MARGIN + 2
    const textX = bulletX + 10
    const maxWidth = page.getWidth() - textX - PAGE_MARGIN

    items.forEach((item) => {
      const lines = wrapText(item, regularFont, fontSize, maxWidth)
      const rowHeight = lineHeight * lines.length
      ensureSpace(rowHeight)
      lines.forEach((line, lineIndex) => {
        const baseline = cursorY - fontSize
        if (lineIndex === 0) {
          page.drawText(bullet, {
            x: bulletX,
            y: baseline,
            size: fontSize,
            font: boldFont,
            color: HEADER_COLOR,
          })
        }
        page.drawText(line, {
          x: textX,
          y: baseline,
          size: fontSize,
          font: regularFont,
          color: TEXT_COLOR,
        })
        cursorY -= lineHeight
      })
    })
  }

  const drawCategoryTable = () => {
    const categories = report.categories.slice(0, 6)
    if (categories.length === 0) {
      drawTextLine("Categorize more transactions to unlock category analytics.", { size: 11, color: MUTED_COLOR })
      return
    }

    const columns = [
      { width: 220 },
      { width: 90 },
      { width: 90 },
      { width: 80 },
      { width: 52 },
    ]
    const headers = ["Category", "Spent", "Budget", "Usage", "Txns"]
    const rowHeight = 22

    const tableWidth = columns.reduce((total, column) => total + column.width, 0)
    const startX = PAGE_MARGIN

    const drawHeaderRow = () => {
      ensureSpace(rowHeight)
      cursorY -= rowHeight
      const y = cursorY
      page.drawRectangle({ x: startX, y, width: tableWidth, height: rowHeight, color: rgb(0.9, 0.93, 0.98) })

      let columnX = startX
      headers.forEach((header, index) => {
        page.drawText(header, {
          x: columnX + 6,
          y: y + rowHeight - 14,
          size: 10,
          font: boldFont,
          color: HEADER_COLOR,
        })
        columnX += columns[index].width
      })
    }

    drawHeaderRow()

    categories.forEach((category, index) => {
      ensureSpace(rowHeight)
      cursorY -= rowHeight
      const y = cursorY
      if (index % 2 === 0) {
        page.drawRectangle({ x: startX, y, width: tableWidth, height: rowHeight, color: rgb(0.97, 0.98, 1) })
      }

      let columnX = startX
      const colorHex = category.colorHex || "#64748b"
      const swatchColor = hexToRgb(colorHex)

      page.drawRectangle({ x: columnX + 6, y: y + 6, width: 8, height: 10, color: swatchColor })
      page.drawText(category.name, {
        x: columnX + 20,
        y: y + 6,
        size: 10,
        font: regularFont,
        color: TEXT_COLOR,
      })
      columnX += columns[0].width

      const spentText = formatCurrency(category.spent, true)
      const spentX = columnX + columns[1].width - 6 - regularFont.widthOfTextAtSize(spentText, 10)
      page.drawText(spentText, {
        x: spentX,
        y: y + 6,
        size: 10,
        font: regularFont,
        color: TEXT_COLOR,
      })
      columnX += columns[1].width

      const budgetText = category.budget > 0 ? formatCurrency(category.budget, true) : "—"
      const budgetX = columnX + columns[2].width - 6 - regularFont.widthOfTextAtSize(budgetText, 10)
      page.drawText(budgetText, {
        x: budgetX,
        y: y + 6,
        size: 10,
        font: regularFont,
        color: MUTED_COLOR,
      })
      columnX += columns[2].width

      const usagePercent = category.budget > 0 ? (category.spent / category.budget) * 100 : null
      const usageText = usagePercent === null ? "—" : `${Math.round(usagePercent)}%`
      const usageColor = usagePercent !== null && usagePercent > 100 ? NEGATIVE_COLOR : TEXT_COLOR
      const usageX = columnX + columns[3].width - 6 - regularFont.widthOfTextAtSize(usageText, 10)
      page.drawText(usageText, {
        x: usageX,
        y: y + 6,
        size: 10,
        font: regularFont,
        color: usageColor,
      })
      columnX += columns[3].width

      const txnText = integerFormatter.format(category.transactions)
      const txnX = columnX + columns[4].width - 6 - regularFont.widthOfTextAtSize(txnText, 10)
      page.drawText(txnText, {
        x: txnX,
        y: y + 6,
        size: 10,
        font: regularFont,
        color: MUTED_COLOR,
      })
    })

    if (report.categories.length > categories.length) {
      drawTextLine(`+${report.categories.length - categories.length} more categories`, {
        size: 10,
        color: MUTED_COLOR,
        lineHeight: 14,
      })
    }
  }
  const drawAccountTable = (accounts: AccountSummary[]) => {
    if (accounts.length === 0) {
      drawTextLine("Create accounts to track how money moves between them.", { size: 11, color: MUTED_COLOR })
      return
    }

    const rows = accounts.slice(0, 8)
    const columns = [
      { width: 220 },
      { width: 96 },
      { width: 96 },
      { width: 80 },
      { width: 40 },
    ]
    const headers = ["Account", "Inflows", "Outflows", "Net", "Txns"]
    const rowHeight = 22
    const tableWidth = columns.reduce((total, column) => total + column.width, 0)
    const startX = PAGE_MARGIN

    const drawHeaderRow = () => {
      ensureSpace(rowHeight)
      cursorY -= rowHeight
      const y = cursorY
      page.drawRectangle({ x: startX, y, width: tableWidth, height: rowHeight, color: rgb(0.9, 0.93, 0.98) })

      let columnX = startX
      headers.forEach((header, index) => {
        page.drawText(header, {
          x: columnX + 6,
          y: y + rowHeight - 14,
          size: 10,
          font: boldFont,
          color: HEADER_COLOR,
        })
        columnX += columns[index].width
      })
    }

    drawHeaderRow()

    rows.forEach((account, index) => {
      ensureSpace(rowHeight)
      cursorY -= rowHeight
      const y = cursorY
      if (index % 2 === 0) {
        page.drawRectangle({ x: startX, y, width: tableWidth, height: rowHeight, color: rgb(0.97, 0.98, 1) })
      }

      let columnX = startX
      page.drawText(account.name, {
        x: columnX + 6,
        y: y + 6,
        size: 10,
        font: regularFont,
        color: TEXT_COLOR,
      })
      columnX += columns[0].width

      const inflowText = formatCurrency(account.inflow, true)
      const inflowX = columnX + columns[1].width - 6 - regularFont.widthOfTextAtSize(inflowText, 10)
      page.drawText(inflowText, {
        x: inflowX,
        y: y + 6,
        size: 10,
        font: regularFont,
        color: POSITIVE_COLOR,
      })
      columnX += columns[1].width

      const outflowText = formatCurrency(-account.outflow, true)
      const outflowX = columnX + columns[2].width - 6 - regularFont.widthOfTextAtSize(outflowText, 10)
      page.drawText(outflowText, {
        x: outflowX,
        y: y + 6,
        size: 10,
        font: regularFont,
        color: NEGATIVE_COLOR,
      })
      columnX += columns[2].width

      const netText = formatCurrency(account.net, true)
      const netColor = account.net > 0 ? POSITIVE_COLOR : account.net < 0 ? NEGATIVE_COLOR : MUTED_COLOR
      const netX = columnX + columns[3].width - 6 - regularFont.widthOfTextAtSize(netText, 10)
      page.drawText(netText, {
        x: netX,
        y: y + 6,
        size: 10,
        font: regularFont,
        color: netColor,
      })
      columnX += columns[3].width

      const txnText = integerFormatter.format(account.transactions)
      const txnX = columnX + columns[4].width - 6 - regularFont.widthOfTextAtSize(txnText, 10)
      page.drawText(txnText, {
        x: txnX,
        y: y + 6,
        size: 10,
        font: regularFont,
        color: MUTED_COLOR,
      })
    })

    if (accounts.length > rows.length) {
      drawTextLine(`+${accounts.length - rows.length} more accounts`, { size: 10, color: MUTED_COLOR, lineHeight: 14 })
    }
  }

  const drawCashFlowTable = () => {
    const months = report.incomeExpense.slice(-6)
    if (months.length === 0) {
      drawTextLine("Record income and expenses to see cash flow trends.", { size: 11, color: MUTED_COLOR })
      return
    }

    const columns = [
      { width: 120 },
      { width: 120 },
      { width: 120 },
      { width: 120 },
    ]
    const headers = ["Month", "Income", "Expenses", "Net"]
    const rowHeight = 22
    const tableWidth = columns.reduce((total, column) => total + column.width, 0)
    const startX = PAGE_MARGIN

    const drawHeaderRow = () => {
      ensureSpace(rowHeight)
      cursorY -= rowHeight
      const y = cursorY
      page.drawRectangle({ x: startX, y, width: tableWidth, height: rowHeight, color: rgb(0.9, 0.93, 0.98) })

      let columnX = startX
      headers.forEach((header, index) => {
        page.drawText(header, {
          x: columnX + 6,
          y: y + rowHeight - 14,
          size: 10,
          font: boldFont,
          color: HEADER_COLOR,
        })
        columnX += columns[index].width
      })
    }

    drawHeaderRow()

    months.forEach((month, index) => {
      ensureSpace(rowHeight)
      cursorY -= rowHeight
      const y = cursorY
      if (index % 2 === 0) {
        page.drawRectangle({ x: startX, y, width: tableWidth, height: rowHeight, color: rgb(0.97, 0.98, 1) })
      }

      const net = month.income - month.expenses

      let columnX = startX
      page.drawText(month.month, {
        x: columnX + 6,
        y: y + 6,
        size: 10,
        font: regularFont,
        color: TEXT_COLOR,
      })
      columnX += columns[0].width

      const incomeText = formatCurrency(month.income, true)
      const incomeX = columnX + columns[1].width - 6 - regularFont.widthOfTextAtSize(incomeText, 10)
      page.drawText(incomeText, {
        x: incomeX,
        y: y + 6,
        size: 10,
        font: regularFont,
        color: POSITIVE_COLOR,
      })
      columnX += columns[1].width

      const expenseText = formatCurrency(-month.expenses, true)
      const expenseX = columnX + columns[2].width - 6 - regularFont.widthOfTextAtSize(expenseText, 10)
      page.drawText(expenseText, {
        x: expenseX,
        y: y + 6,
        size: 10,
        font: regularFont,
        color: NEGATIVE_COLOR,
      })
      columnX += columns[2].width

      const netText = formatCurrency(net, true)
      const netColor = net > 0 ? POSITIVE_COLOR : net < 0 ? NEGATIVE_COLOR : MUTED_COLOR
      const netX = columnX + columns[3].width - 6 - regularFont.widthOfTextAtSize(netText, 10)
      page.drawText(netText, {
        x: netX,
        y: y + 6,
        size: 10,
        font: regularFont,
        color: netColor,
      })
    })
  }
  const drawHighlightsSection = () => {
    drawSectionHeading("Highlights", "Key takeaways captured during this period.")
    if (report.highlights.length === 0) {
      drawTextLine("Highlights will appear once more activity is categorized.", { size: 11, color: MUTED_COLOR })
    } else {
      drawBulletList(report.highlights)
    }

    if (report.insights.length > 0) {
      drawSpacer(8)
      drawSectionHeading("Insights", "Automatic observations based on your data.")
      const insightItems = report.insights.map((insight) => `${insight.title} — ${insight.description}`)
      drawBulletList(insightItems)
    }
  }

  const drawYearlySummary = () => {
    if (report.yearlyComparison.length === 0) {
      return
    }

    const totals = report.yearlyComparison.reduce(
      (acc, row) => {
        acc.current += row.current
        acc.previous += row.previous
        return acc
      },
      { current: 0, previous: 0 },
    )

    const change = totals.previous === 0 ? null : ((totals.current - totals.previous) / totals.previous) * 100
    const changeText = change === null ? "No prior year data" : formatPercent(change)
    const changeColor = change === null ? MUTED_COLOR : change >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR

    drawTextLine(`Current year spending: ${formatCurrency(totals.current, true)}`, {
      size: 11,
      color: TEXT_COLOR,
    })
    drawTextLine(`Previous year spending: ${formatCurrency(totals.previous, true)}`, {
      size: 11,
      color: MUTED_COLOR,
    })
    drawTextLine(`Change: ${changeText}`, {
      size: 11,
      color: changeColor,
    })

    const highestCurrent = report.yearlyComparison.reduce((prev, row) => (row.current > prev.current ? row : prev))
    const highestPrevious = report.yearlyComparison.reduce((prev, row) => (row.previous > prev.previous ? row : prev))

    drawTextLine(
      `Peak month this year: ${highestCurrent.month} (${formatCurrency(highestCurrent.current, true)})`,
      { size: 10, color: TEXT_COLOR, lineHeight: 14 },
    )
    drawTextLine(
      `Peak month last year: ${highestPrevious.month} (${formatCurrency(highestPrevious.previous, true)})`,
      { size: 10, color: MUTED_COLOR, lineHeight: 14 },
    )
  }

  const currentPeriodLabel = formatDateRange(report.startDate, report.endDate)
  const generatedAt = new Date()

  drawTextLine("CashTrack Financial Report", {
    font: boldFont,
    size: 22,
    lineHeight: 30,
    color: HEADER_COLOR,
  })
  drawTextLine(report.label, { font: boldFont, size: 14, lineHeight: 20 })
  drawTextLine(currentPeriodLabel, { size: 11, color: MUTED_COLOR, lineHeight: 16 })
  drawTextLine(`Generated on ${generatedAt.toLocaleString()}`, { size: 10, color: MUTED_COLOR, lineHeight: 16 })
  drawDivider()

  drawSectionHeading("Key metrics", "A snapshot of income, expenses, and savings performance.")
  drawSummaryCards(report.summary)
  drawSpacer(18)

  drawHighlightsSection()
  drawSpacer(18)

  drawSectionHeading("Top spending categories", "Where your money went during this period.")
  drawCategoryTable()
  drawSpacer(18)

  drawSectionHeading("Account activity", "Monitor how money moved between your accounts.")
  drawAccountTable(report.accounts)
  drawSpacer(18)

  drawSectionHeading("Monthly cash flow", "Income versus expenses over the most recent months.")
  drawCashFlowTable()
  drawSpacer(18)

  drawSectionHeading("Yearly comparison", "Compare this year's spending to the prior year.")
  drawYearlySummary()

  const footerPage = page
  footerPage.drawRectangle({
    x: PAGE_MARGIN,
    y: PAGE_MARGIN / 2,
    width: footerPage.getWidth() - PAGE_MARGIN * 2,
    height: 0.5,
    color: DIVIDER_COLOR,
  })
  footerPage.drawText("cashtrack", {
    x: PAGE_MARGIN,
    y: PAGE_MARGIN / 2 + 4,
    size: 9,
    font: boldFont,
    color: HEADER_COLOR,
  })
  footerPage.drawText("Household insights at a glance", {
    x: footerPage.getWidth() - PAGE_MARGIN - regularFont.widthOfTextAtSize("Household insights at a glance", 9),
    y: PAGE_MARGIN / 2 + 4,
    size: 9,
    font: regularFont,
    color: MUTED_COLOR,
  })

  return doc.save()
}
