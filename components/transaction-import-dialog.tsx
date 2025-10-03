"use client"

import { useEffect, useMemo, useState } from "react"
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
import { FileText, CheckCircle, Loader2, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { TransactionType } from "@/lib/transactions/types"
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

interface PreviewTransaction {
  date: string
  description: string
  amount: number
  categoryName?: string
  account?: string
  status?: string
  type: TransactionType
  notes?: string
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

  useEffect(() => {
    if (!open) {
      setStep("upload")
      setSelectedFile(null)
      setFileKind(null)
      setAvailableColumns([])
      setMapping({ date: "", description: "", amount: "" })
      setPreview([])
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
          setPreview(previewResponse.preview)
          setPreviewTotal(previewResponse.total)
          setPreviewErrors(previewResponse.errors)
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
        setPreview(previewResponse.preview)
        setPreviewTotal(previewResponse.total)
        setPreviewErrors(previewResponse.errors)
        setStep("preview")
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : t("Failed to process file"))
      } finally {
        setIsProcessing(false)
      }
    }

    if (step === "preview") {
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
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{t("Import Transactions")}</DialogTitle>
          <DialogDescription>
            {t("Upload a CSV or PDF statement from your bank or financial institution")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{t("Preview Transactions")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {t("Showing first {{visible}} of {{total}} rows", {
                      values: { visible: preview.length.toString(), total: previewTotal.toString() },
                    })}
                  </p>
                </div>
                {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
              </div>
              <div className="rounded-md border">
                <div className="space-y-2 p-4">
                  {preview.map((transaction, index) => (
                    <div key={index} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-b-0">
                      <div>
                        <p className="font-medium">{transaction.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {transaction.date} • {transaction.categoryName ?? t("Uncategorized")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={transaction.type === "income" ? "text-sm font-semibold text-green-600" : "text-sm font-semibold text-red-600"}>
                          {transaction.type === "income" ? "+" : "-"}${Math.abs(transaction.amount).toFixed(2)}
                        </p>
                        {transaction.account && <p className="text-xs text-muted-foreground">{transaction.account}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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

        <DialogFooter>
          {step === "success" ? (
            <Button onClick={handleClose}>{t("Done")}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
                {t("Cancel")}
              </Button>
              <Button onClick={handleNext} disabled={isProcessing || (step === "upload" && !selectedFile)}>
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
      </DialogContent>
    </Dialog>
  )
}
