"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { FileText, CheckCircle, Loader2, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ParsedCsvTransaction, TransactionStatus, TransactionType } from "@/lib/transactions/types"
import { cn } from "@/lib/utils"
import { useTranslations } from "@/components/language-provider"

interface TransactionImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: (importedCount: number) => void
}

type ImportStep = "upload" | "mapping" | "preview" | "success"

type ColumnMapping = {
  date: string
  description: string
  amount: string
  category?: string
  account?: string
  status?: string
  type?: string
  notes?: string
}

type DuplicateMatchReason = "amount" | "description"

interface DuplicatePreview {
  id: string
  date: string
  description: string
  amount: number
  accountAmount: number
  originalAmount: number
  currency: string
  account: string
  status: TransactionStatus
  type: TransactionType
  matchReasons: DuplicateMatchReason[]
}

interface PreviewTransaction {
  id: string
  sourceId: string
  date: string
  description: string
  amount: number
  categoryId: string | null
  categoryName: string | null
  account: string | null
  status: TransactionStatus
  type: TransactionType
  notes: string | null
  originalAmount: number | null
  accountAmount: number | null
  currency: string | null
  exchangeRate: number | null
  sourceLine: number | null
  duplicates: DuplicatePreview[]
}

interface EditableTransaction extends PreviewTransaction {
  include: boolean
  decision: "import" | "skip" | "pending"
}

interface ImportPreviewResponse {
  preview: PreviewTransaction[]
  total: number
  errors: Array<{ line: number; message: string }>
}

interface ImportResult extends ImportPreviewResponse {
  imported: number
  skipped: number
}

const OPTIONAL_LABEL_KEY = "None"
const CUSTOM_ACCOUNT_VALUE = "__custom__"

type AccountOption = {
  id: string
  name: string
  currency?: string | null
}

const STATUS_OPTIONS: TransactionStatus[] = ["pending", "completed", "cleared"]
const TYPE_OPTIONS: TransactionType[] = ["income", "expense", "transfer"]

const parseHeader = (content: string): string[] => {
  const [firstLine] = content.split(/\r?\n/, 1)
  if (!firstLine) {
    return []
  }
  const columns: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < firstLine.length; i++) {
    const char = firstLine[i]
    if (char === "\"") {
      if (inQuotes && firstLine[i + 1] === "\"") {
        current += "\""
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === "," && !inQuotes) {
      columns.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }

  columns.push(current.trim())
  return columns.filter((column) => column.length > 0)
}

export function TransactionImportDialog({ open, onOpenChange, onComplete }: TransactionImportDialogProps) {
  const { t } = useTranslations()
  const optionalLabel = t(OPTIONAL_LABEL_KEY)
  const defaultStatementName = t("Statement")
  const [step, setStep] = useState<ImportStep>("upload")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileKind, setFileKind] = useState<"csv" | "pdf" | null>(null)
  const [availableColumns, setAvailableColumns] = useState<string[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({ date: "", description: "", amount: "" })
  const [preview, setPreview] = useState<PreviewTransaction[]>([])
  const [initialPreviewMap, setInitialPreviewMap] = useState<Record<string, PreviewTransaction>>({})
  const [drafts, setDrafts] = useState<EditableTransaction[]>([])
  const [previewTotal, setPreviewTotal] = useState(0)
  const [previewErrors, setPreviewErrors] = useState<Array<{ line: number; message: string }>>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [pdfAccountName, setPdfAccountName] = useState("")
  const [suggestedPdfAccountName, setSuggestedPdfAccountName] = useState(defaultStatementName)
  const [accountOptions, setAccountOptions] = useState<AccountOption[]>([])
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [pdfAccountSelection, setPdfAccountSelection] = useState<string>("")

  const requiredFields = useMemo(() => ({
    date: mapping.date,
    description: mapping.description,
    amount: mapping.amount,
  }), [mapping])

  const computeActiveDuplicates = useCallback(
    (transaction: EditableTransaction) => {
      if (!transaction.duplicates.length) {
        return [] as DuplicatePreview[]
      }

      const normalizedDescription = transaction.description.trim().toLowerCase()
      const signedAmount =
        transaction.type === "expense" ? -Math.abs(transaction.amount) : Math.abs(transaction.amount)
      const accountAmountCandidate =
        typeof transaction.accountAmount === "number"
          ? transaction.type === "expense"
            ? -Math.abs(transaction.accountAmount)
            : Math.abs(transaction.accountAmount)
          : null
      const originalAmountCandidate =
        typeof transaction.originalAmount === "number" ? Math.abs(transaction.originalAmount) : null

      return transaction.duplicates.filter((candidate) => {
        const checks: boolean[] = []

        if (candidate.matchReasons.includes("description")) {
          checks.push(normalizedDescription === candidate.description.trim().toLowerCase())
        }

        if (candidate.matchReasons.includes("amount")) {
          const amountMatch = Math.abs(candidate.amount - signedAmount) <= 0.01
          const accountMatch =
            accountAmountCandidate !== null
              ? Math.abs(Math.abs(candidate.accountAmount) - Math.abs(accountAmountCandidate)) <= 0.01
              : false
          const originalMatch =
            originalAmountCandidate !== null
              ? Math.abs(Math.abs(candidate.originalAmount) - originalAmountCandidate) <= 0.01
              : false
          checks.push(amountMatch || accountMatch || originalMatch)
        }

        return checks.length === 0 ? false : checks.some(Boolean)
      })
    },
    [],
  )

  const includedCount = useMemo(() => drafts.filter((draft) => draft.include).length, [drafts])
  const hasPendingDuplicates = useMemo(
    () =>
      drafts.some(
        (draft) =>
          draft.include && computeActiveDuplicates(draft).length > 0 && draft.decision === "pending",
      ),
    [computeActiveDuplicates, drafts],
  )

  const updateDraft = useCallback(
    (sourceId: string, updater: (draft: EditableTransaction) => EditableTransaction) => {
      setDrafts((current) =>
        current.map((item) => {
          if (item.sourceId !== sourceId) {
            return item
          }
          const next = updater(item)
          const activeDuplicates = computeActiveDuplicates(next)
          if (activeDuplicates.length === 0 && next.decision === "pending") {
            return { ...next, decision: "import" }
          }
          return next
        }),
      )
    },
    [computeActiveDuplicates],
  )

  const applyPreviewResponse = useCallback((previewResponse: ImportPreviewResponse) => {
    setError(null)
    setResult(null)
    setPreview(previewResponse.preview)
    setPreviewTotal(previewResponse.total)
    setPreviewErrors(previewResponse.errors)
    const previewMap: Record<string, PreviewTransaction> = {}
    previewResponse.preview.forEach((item) => {
      previewMap[item.sourceId] = item
    })
    setInitialPreviewMap(previewMap)
    setDrafts(
      previewResponse.preview.map((item) => ({
        ...item,
        include: true,
        decision: item.duplicates.length > 0 ? "pending" : "import",
      })),
    )
  }, [])

  const buildOverridePayload = useCallback(() => {
    const overrides: Record<string, Partial<ParsedCsvTransaction>> = {}
    drafts.forEach((draft) => {
      const original = initialPreviewMap[draft.sourceId]
      if (!original) {
        return
      }
      const patch: Partial<ParsedCsvTransaction> = {}
      if (draft.date !== original.date) {
        patch.date = draft.date
      }
      if (draft.description !== original.description) {
        patch.description = draft.description
      }
      if (draft.amount !== original.amount) {
        patch.amount = draft.amount
      }
      const currentCategoryName = draft.categoryName ?? ""
      const originalCategoryName = original.categoryName ?? ""
      if (currentCategoryName !== originalCategoryName) {
        patch.categoryName = currentCategoryName
      }
      const currentAccount = draft.account ?? ""
      const originalAccount = original.account ?? ""
      if (currentAccount !== originalAccount) {
        patch.account = currentAccount
      }
      if (draft.status !== original.status) {
        patch.status = draft.status
      }
      if (draft.type !== original.type) {
        patch.type = draft.type
      }
      const normalizedNotes = draft.notes ?? null
      const originalNotes = original.notes ?? null
      if (normalizedNotes !== originalNotes) {
        patch.notes = normalizedNotes
      }
      if ((draft.originalAmount ?? null) !== (original.originalAmount ?? null)) {
        patch.originalAmount = draft.originalAmount ?? null
      }
      if ((draft.accountAmount ?? null) !== (original.accountAmount ?? null)) {
        patch.accountAmount = draft.accountAmount ?? null
      }
      const currentCurrency = draft.currency ?? ""
      const originalCurrency = original.currency ?? ""
      if (currentCurrency !== originalCurrency) {
        patch.currency = currentCurrency
      }
      if ((draft.exchangeRate ?? null) !== (original.exchangeRate ?? null)) {
        patch.exchangeRate = draft.exchangeRate ?? null
      }
      if (Object.keys(patch).length > 0) {
        overrides[draft.sourceId] = patch
      }
    })
    return overrides
  }, [drafts, initialPreviewMap])

  const buildSelectionPayload = useCallback(() => {
    const selections: Record<string, boolean> = {}
    drafts.forEach((draft) => {
      if (!draft.include) {
        selections[draft.sourceId] = false
      }
    })
    return selections
  }, [drafts])

  const buildDuplicateDecisionPayload = useCallback(() => {
    const decisions: Record<string, "import" | "skip"> = {}
    drafts.forEach((draft) => {
      if (!draft.include) {
        return
      }
      const activeDuplicates = computeActiveDuplicates(draft)
      if (!activeDuplicates.length) {
        return
      }
      if (draft.decision === "import" || draft.decision === "skip") {
        decisions[draft.sourceId] = draft.decision
      }
    })
    return decisions
  }, [computeActiveDuplicates, drafts])

  useEffect(() => {
    if (!open) {
      setStep("upload")
      setSelectedFile(null)
      setFileKind(null)
      setAvailableColumns([])
      setMapping({ date: "", description: "", amount: "" })
      setPreview([])
      setInitialPreviewMap({})
      setDrafts([])
      setPreviewTotal(0)
      setPreviewErrors([])
      setResult(null)
      setError(null)
      setIsProcessing(false)
      setPdfAccountName("")
      setSuggestedPdfAccountName(defaultStatementName)
      setAccountOptions([])
      setAccountsError(null)
      setPdfAccountSelection("")
    }
  }, [open, defaultStatementName])

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false
    const controller = new AbortController()
    setAccountsLoading(true)
    setAccountsError(null)

    fetch("/api/accounts", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(typeof body.error === "string" ? body.error : t("Unable to load accounts"))
        }
        const data = (await response.json()) as {
          accounts: Array<{ id: string; name: string; currency?: string | null }>
        }
        if (cancelled) {
          return
        }
        const options = data.accounts
          .map((account) => ({
            id: account.id,
            name: account.name,
            currency: account.currency ?? null,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
        setAccountOptions(options)
      })
      .catch((loadError) => {
        if (controller.signal.aborted || cancelled) {
          return
        }
        console.error(loadError)
        setAccountsError(loadError instanceof Error ? loadError.message : t("Unable to load accounts"))
      })
      .finally(() => {
        if (!cancelled) {
          setAccountsLoading(false)
        }
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [open, t])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setError(null)
    if (file) {
      setSelectedFile(file)
      const extension = typeof file.name === "string" ? file.name.toLowerCase() : ""
      const isPdf = file.type === "application/pdf" || extension.endsWith(".pdf")
      setFileKind(isPdf ? "pdf" : "csv")

      if (isPdf) {
        const baseName = extension ? file.name.replace(/\.[^/.]+$/, "") : defaultStatementName
        const suggestion = baseName || defaultStatementName
        setSuggestedPdfAccountName(suggestion)
        setPdfAccountName(suggestion)
        setPdfAccountSelection("")
        setAvailableColumns([])
        setMapping({ date: "", description: "", amount: "" })
        return
      }

      const reader = new FileReader()
      reader.onload = (loadEvent) => {
        const text = String(loadEvent.target?.result ?? "")
        const headers = parseHeader(text)
        setAvailableColumns(headers)
        setMapping((previous) => {
          const updated: ColumnMapping = {
            date: previous.date,
            description: previous.description,
            amount: previous.amount,
            category: previous.category,
            account: previous.account,
            status: previous.status,
            type: previous.type,
            notes: previous.notes,
          }

          const normalized = headers.map((header) => header.trim().toLowerCase())
          const findColumn = (needle: string) => {
            const index = normalized.indexOf(needle)
            return index >= 0 ? headers[index] : ""
          }

          return {
            date: updated.date || findColumn("date"),
            description: updated.description || findColumn("description"),
            amount: updated.amount || findColumn("amount"),
            category: updated.category,
            account: updated.account,
            status: updated.status,
            type: updated.type,
            notes: updated.notes,
          }
        })
      }
      reader.readAsText(file)
    } else {
      setSelectedFile(null)
      setAvailableColumns([])
      setFileKind(null)
      setPdfAccountName("")
      setSuggestedPdfAccountName(defaultStatementName)
      setPdfAccountSelection("")
    }
  }

  const submitImport = async (dryRun: boolean) => {
    if (!selectedFile) {
      throw new Error(t("Please select a file to import"))
    }

    const formData = new FormData()
    formData.append("file", selectedFile)
    formData.append("dryRun", String(dryRun))
    formData.append("importType", fileKind ?? "csv")

    if (fileKind === "pdf") {
      if (pdfAccountName.trim()) {
        formData.append("accountName", pdfAccountName.trim())
      }
    } else {
      const payload: ColumnMapping = {
        date: mapping.date,
        description: mapping.description,
        amount: mapping.amount,
      }

      if (mapping.category) payload.category = mapping.category
      if (mapping.account) payload.account = mapping.account
      if (mapping.status) payload.status = mapping.status
      if (mapping.type) payload.type = mapping.type
      if (mapping.notes) payload.notes = mapping.notes

      formData.append("mapping", JSON.stringify(payload))
    }

    if (!dryRun) {
      const overrides = buildOverridePayload()
      const selections = buildSelectionPayload()
      const duplicateDecisions = buildDuplicateDecisionPayload()
      if (Object.keys(overrides).length > 0) {
        formData.append("overrides", JSON.stringify(overrides))
      }
      if (Object.keys(selections).length > 0) {
        formData.append("selections", JSON.stringify(selections))
      }
      if (Object.keys(duplicateDecisions).length > 0) {
        formData.append("duplicateDecisions", JSON.stringify(duplicateDecisions))
      }
    }

    const response = await fetch("/api/transactions/import", {
      method: "POST",
      body: formData,
      credentials: "include",
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? t("Import failed"))
    }

    return (await response.json()) as ImportPreviewResponse | ImportResult
  }

  const handleNext = async () => {
    setError(null)

    if (step === "upload") {
      if (!selectedFile) {
        setError(t("Select a statement file to continue"))
        return
      }
      if (fileKind === "pdf") {
        if (!pdfAccountSelection) {
          setError(t("Select the account for this statement"))
          return
        }
        if (pdfAccountSelection === CUSTOM_ACCOUNT_VALUE && !pdfAccountName.trim()) {
          setError(t("Enter an account name"))
          return
        }
        try {
          setIsProcessing(true)
          const previewResponse = (await submitImport(true)) as ImportPreviewResponse
          applyPreviewResponse(previewResponse)
          setStep("preview")
        } catch (submitError) {
          setError(submitError instanceof Error ? submitError.message : t("Failed to process file"))
        } finally {
          setIsProcessing(false)
        }
        return
      }
      setStep("mapping")
      return
    }

    if (step === "mapping") {
      if (!requiredFields.date || !requiredFields.description || !requiredFields.amount) {
        setError(t("Please map the date, description, and amount columns"))
        return
      }

      try {
        setIsProcessing(true)
        const previewResponse = (await submitImport(true)) as ImportPreviewResponse
        applyPreviewResponse(previewResponse)
        setStep("preview")
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : t("Failed to process file"))
      } finally {
        setIsProcessing(false)
      }
    }

    if (step === "preview") {
      const unresolved = drafts.filter((draft) => {
        if (!draft.include) {
          return false
        }
        const active = computeActiveDuplicates(draft)
        return active.length > 0 && draft.decision === "pending"
      })
      if (unresolved.length > 0) {
        setError(t("Review duplicate matches before importing"))
        return
      }

      try {
        setIsProcessing(true)
        const importResponse = (await submitImport(false)) as ImportResult
        setResult(importResponse)
        setStep("success")
        onComplete?.(importResponse.imported)
      } catch (importError) {
        setError(importError instanceof Error ? importError.message : t("Failed to import transactions"))
      } finally {
        setIsProcessing(false)
      }
    }
  }

  const handleClose = () => {
    if (!isProcessing) {
      onOpenChange(false)
    }
  }

  const renderError = () => {
    if (!error) return null
    return (
      <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        <AlertTriangle className="h-4 w-4" />
        <span>{error}</span>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[min(100%-2rem,80rem)] overflow-hidden p-0 sm:max-w-5xl">
        <div className="flex h-full max-h-[90vh] flex-col">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>{t("Import Transactions")}</DialogTitle>
            <DialogDescription>
              {t("Upload a CSV or PDF statement from your bank or financial institution")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 min-h-0">
            <div className="space-y-4 pb-6">
              {renderError()}

              {step === "upload" && (
                <div className="space-y-4">
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="csv-file">{t("Statement File")}</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv,.pdf"
                  onChange={handleFileSelect}
                  disabled={isProcessing}
                />
              </div>

              {selectedFile && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">{t("Selected File")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm">{selectedFile.name}</span>
                      <span className="text-xs text-muted-foreground">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  </CardContent>
                </Card>
              )}
              {fileKind === "pdf" && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>{t("Statement account")}</Label>
                    <Select
                      value={pdfAccountSelection}
                      onValueChange={(value) => {
                        setPdfAccountSelection(value)
                        if (value === CUSTOM_ACCOUNT_VALUE) {
                          setPdfAccountName(suggestedPdfAccountName)
                          return
                        }
                        const selected = accountOptions.find((option) => option.id === value)
                        setPdfAccountName(selected ? selected.name : "")
                      }}
                      disabled={accountsLoading || isProcessing}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={accountsLoading ? t("Loading accounts...") : t("Select account")} />
                      </SelectTrigger>
                      <SelectContent>
                        {accountOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name}
                            {option.currency ? ` (${option.currency.toUpperCase()})` : ""}
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_ACCOUNT_VALUE}>{t("Other account")}</SelectItem>
                      </SelectContent>
                    </Select>
                    {accountsError && (
                      <p className="text-xs text-destructive">{accountsError}</p>
                    )}
                  </div>
                  {pdfAccountSelection === CUSTOM_ACCOUNT_VALUE && (
                    <div className="space-y-2">
                      <Label htmlFor="pdf-account-name">{t("Account name")}</Label>
                      <Input
                        id="pdf-account-name"
                        value={pdfAccountName}
                        onChange={(event) => setPdfAccountName(event.target.value)}
                        disabled={isProcessing}
                      />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t("Transactions imported from this statement will be assigned to the selected account.")}
                  </p>
                </div>
              )}
            </div>
          )}

          {step === "mapping" && fileKind !== "pdf" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t("Map your CSV columns to transaction fields")}</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  { label: t("Date Column"), field: "date", required: true },
                  { label: t("Description Column"), field: "description", required: true },
                  { label: t("Amount Column"), field: "amount", required: true },
                  { label: t("Category Column"), field: "category", required: false },
                  { label: t("Account Column"), field: "account", required: false },
                  { label: t("Status Column"), field: "status", required: false },
                  { label: t("Type Column"), field: "type", required: false },
                  { label: t("Notes Column"), field: "notes", required: false },
                ].map(({ label, field, required }) => (
                  <div key={field} className="space-y-2">
                    <Label>
                      {label}
                      {!required && <span className="text-xs text-muted-foreground"> ({optionalLabel})</span>}
                    </Label>
                    <Select
                      value={(mapping as Record<string, string | undefined>)[field] ?? ""}
                      onValueChange={(value) =>
                        setMapping((previous) => ({
                          ...previous,
                          [field]: value || "",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={required ? t("Select column") : optionalLabel} />
                      </SelectTrigger>
                      <SelectContent>
                        {!required && (
                          <SelectItem value="">
                            <span className="text-muted-foreground">{optionalLabel}</span>
                          </SelectItem>
                        )}
                        {availableColumns.map((column) => (
                          <SelectItem key={column} value={column}>
                            {column}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{t("Review transactions")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("{{selected}} of {{total}} transactions selected", {
                      values: {
                        selected: includedCount.toString(),
                        total: previewTotal.toString(),
                      },
                    })}
                  </p>
                </div>
                {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              {drafts.length > 0 ? (
                <ScrollArea className="max-h-[50vh] rounded-md border">
                  <div className="space-y-3 p-4">
                    {drafts.map((draft) => {
                      const activeDuplicates = computeActiveDuplicates(draft)
                      const requiresDecision = draft.include && activeDuplicates.length > 0 && draft.decision === "pending"
                      const amountDisplay = `${draft.type === "income" ? "+" : draft.type === "expense" ? "-" : ""}${Math.abs(draft.amount).toFixed(2)}`
                      return (
                        <div
                          key={draft.sourceId}
                          className={cn(
                            "space-y-4 rounded-md border p-4 transition-colors",
                            !draft.include && "opacity-60",
                            requiresDecision
                              ? "border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-950"
                              : "bg-background",
                          )}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={draft.include}
                                onCheckedChange={(checked) => {
                                  updateDraft(draft.sourceId, (current) => {
                                    const include = Boolean(checked)
                                    if (!include) {
                                      return { ...current, include: false, decision: "skip" }
                                    }
                                    const duplicates = computeActiveDuplicates(current)
                                    return {
                                      ...current,
                                      include: true,
                                      decision:
                                        duplicates.length > 0
                                          ? current.decision === "skip"
                                            ? "skip"
                                            : "pending"
                                          : "import",
                                    }
                                  })
                                }}
                              />
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium">
                                    {draft.description || t("Untitled transaction")}
                                  </p>
                                  {requiresDecision && (
                                    <Badge variant="outline" className="border-amber-500 text-amber-700 dark:border-amber-400 dark:text-amber-200">
                                      {t("Action required")}
                                    </Badge>
                                  )}
                                  {!draft.include && (
                                    <Badge variant="secondary">{t("Excluded")}</Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {draft.date}
                                  {draft.account ? ` • ${draft.account}` : ""}
                                  {draft.categoryName ? ` • ${draft.categoryName}` : ""}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p
                                className={cn(
                                  "text-sm font-semibold",
                                  draft.type === "income"
                                    ? "text-emerald-600"
                                    : draft.type === "expense"
                                    ? "text-red-600"
                                    : "text-muted-foreground",
                                )}
                              >
                                {amountDisplay}
                              </p>
                              {activeDuplicates.length > 0 && draft.include && (
                                <p className="text-xs text-amber-600 dark:text-amber-300">
                                  {activeDuplicates.length === 1
                                    ? t("1 potential duplicate")
                                    : t("{{count}} potential duplicates", {
                                        values: { count: activeDuplicates.length.toString() },
                                      })}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                              <Label htmlFor={`date-${draft.sourceId}`}>{t("Date")}</Label>
                              <Input
                                id={`date-${draft.sourceId}`}
                                type="date"
                                value={draft.date}
                                onChange={(event) =>
                                  updateDraft(draft.sourceId, (current) => ({
                                    ...current,
                                    date: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <Label htmlFor={`description-${draft.sourceId}`}>{t("Description")}</Label>
                              <Input
                                id={`description-${draft.sourceId}`}
                                value={draft.description}
                                onChange={(event) =>
                                  updateDraft(draft.sourceId, (current) => ({
                                    ...current,
                                    description: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`amount-${draft.sourceId}`}>{t("Amount")}</Label>
                              <Input
                                id={`amount-${draft.sourceId}`}
                                type="number"
                                step="0.01"
                                value={draft.amount}
                                onChange={(event) => {
                                  const value = Number(event.target.value)
                                  updateDraft(draft.sourceId, (current) => ({
                                    ...current,
                                    amount: Number.isFinite(value) ? Math.abs(value) : current.amount,
                                  }))
                                }}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>{t("Type")}</Label>
                              <Select
                                value={draft.type}
                                onValueChange={(value: TransactionType) =>
                                  updateDraft(draft.sourceId, (current) => ({
                                    ...current,
                                    type: value,
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {TYPE_OPTIONS.map((option) => (
                                    <SelectItem key={option} value={option}>
                                      {t(option.charAt(0).toUpperCase() + option.slice(1))}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>{t("Status")}</Label>
                              <Select
                                value={draft.status}
                                onValueChange={(value: TransactionStatus) =>
                                  updateDraft(draft.sourceId, (current) => ({
                                    ...current,
                                    status: value,
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option} value={option}>
                                      {t(option.charAt(0).toUpperCase() + option.slice(1))}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`account-${draft.sourceId}`}>{t("Account")}</Label>
                              <Input
                                id={`account-${draft.sourceId}`}
                                value={draft.account ?? ""}
                                onChange={(event) =>
                                  updateDraft(draft.sourceId, (current) => ({
                                    ...current,
                                    account: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`category-${draft.sourceId}`}>{t("Category")}</Label>
                              <Input
                                id={`category-${draft.sourceId}`}
                                value={draft.categoryName ?? ""}
                                onChange={(event) =>
                                  updateDraft(draft.sourceId, (current) => ({
                                    ...current,
                                    categoryName: event.target.value,
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`currency-${draft.sourceId}`}>{t("Currency")}</Label>
                              <Input
                                id={`currency-${draft.sourceId}`}
                                value={draft.currency ?? ""}
                                placeholder={t("Optional")}
                                onChange={(event) =>
                                  updateDraft(draft.sourceId, (current) => ({
                                    ...current,
                                    currency: event.target.value.toUpperCase(),
                                  }))
                                }
                              />
                            </div>
                            <div className="space-y-2 md:col-span-3">
                              <Label htmlFor={`notes-${draft.sourceId}`}>{t("Notes")}</Label>
                              <Textarea
                                id={`notes-${draft.sourceId}`}
                                value={draft.notes ?? ""}
                                placeholder={t("Optional")}
                                onChange={(event) => {
                                  const value = event.target.value
                                  updateDraft(draft.sourceId, (current) => ({
                                    ...current,
                                    notes: value ? value : null,
                                  }))
                                }}
                              />
                            </div>
                          </div>
                          {draft.duplicates.length > 0 && (
                            <div
                              className={cn(
                                "rounded-md border p-3 text-sm",
                                activeDuplicates.length > 0
                                  ? "border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-500/60 dark:bg-amber-950/40 dark:text-amber-100"
                                  : "border-muted bg-muted/30 text-muted-foreground",
                              )}
                            >
                              {activeDuplicates.length > 0 ? (
                                <div className="space-y-3">
                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                    <p className="font-medium">{t("Possible duplicates detected")}</p>
                                    <RadioGroup
                                      value={draft.decision === "pending" ? "" : draft.decision}
                                      onValueChange={(value) =>
                                        updateDraft(draft.sourceId, (current) => ({
                                          ...current,
                                          decision: value === "import" || value === "skip" ? (value as "import" | "skip") : current.decision,
                                        }))
                                      }
                                      className="flex flex-wrap gap-4"
                                    >
                                      <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="import" id={`duplicate-import-${draft.sourceId}`} />
                                        <Label htmlFor={`duplicate-import-${draft.sourceId}`} className="text-xs">
                                          {t("Import anyway")}
                                        </Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="skip" id={`duplicate-skip-${draft.sourceId}`} />
                                        <Label htmlFor={`duplicate-skip-${draft.sourceId}`} className="text-xs">
                                          {t("Skip new transaction")}
                                        </Label>
                                      </div>
                                    </RadioGroup>
                                  </div>
                                  <div className="space-y-2 text-xs">
                                    {activeDuplicates.map((candidate) => (
                                      <div
                                        key={candidate.id}
                                        className="flex flex-wrap items-center justify-between gap-3 rounded border border-amber-200 bg-white/60 p-2 dark:border-amber-900 dark:bg-transparent"
                                      >
                                        <div>
                                          <p className="font-medium">{candidate.description}</p>
                                          <p className="text-[11px] text-muted-foreground">
                                            {candidate.date} • {candidate.account}
                                          </p>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-sm font-semibold">{candidate.amount.toFixed(2)}</p>
                                          <div className="mt-1 flex flex-wrap gap-1">
                                            {candidate.matchReasons.map((reason, index) => (
                                              <Badge key={`${candidate.id}-${reason}-${index}`} variant="outline">
                                                {reason === "amount" ? t("Amount match") : t("Description match")}
                                              </Badge>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-xs">{t("No duplicate matches after your edits.")}</p>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {t("No transactions detected in this file.")}
                </div>
              )}
              {previewErrors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">{t("Skipped Rows")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {previewErrors.slice(0, 5).map((item, index) => (
                      <p key={index} className="text-xs text-muted-foreground">
                        {t("Line {{line}}: {{message}}", {
                          values: { line: item.line.toString(), message: item.message },
                        })}
                      </p>
                    ))}
                    {previewErrors.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        {t("{{count}} more rows with issues.", {
                          values: { count: (previewErrors.length - 5).toString() },
                        })}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {step === "success" && result && (
            <div className="space-y-4 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
              <div>
                <h3 className="text-lg font-semibold">{t("Import complete")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("{{imported}} transactions imported, {{skipped}} skipped", {
                    values: {
                      imported: result.imported.toString(),
                      skipped: result.skipped.toString(),
                    },
                  })}
                </p>
              </div>
              {result.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t("Some rows were skipped:")}</p>
                  <div className="max-h-32 overflow-y-auto rounded-md border p-2 text-left text-xs">
                    {result.errors.map((item, index) => (
                      <p key={index}>
                        {t("Line {{line}}: {{message}}", {
                          values: { line: item.line.toString(), message: item.message },
                        })}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
          <DialogFooter className="border-t bg-background px-6 py-4">
            {step === "success" ? (
              <Button onClick={handleClose}>{t("Done")}</Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
                  {t("Cancel")}
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={
                    isProcessing ||
                    (step === "upload" && !selectedFile) ||
                    (step === "preview" && hasPendingDuplicates)
                  }
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("Processing")}
                    </>
                  ) : step === "preview" ? (
                    t("Import")
                  ) : (
                    t("Next")
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
      </div>
      </DialogContent>
    </Dialog>
  )
}
