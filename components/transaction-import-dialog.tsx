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

const optionalLabel = "None"

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
  const [pdfAccountName, setPdfAccountName] = useState("Statement")

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
      setPdfAccountName("Statement")
    }
  }, [open])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setError(null)
    if (file) {
      setSelectedFile(file)
      const extension = typeof file.name === "string" ? file.name.toLowerCase() : ""
      const isPdf = file.type === "application/pdf" || extension.endsWith(".pdf")
      setFileKind(isPdf ? "pdf" : "csv")

      if (isPdf) {
        const baseName = extension ? file.name.replace(/\.[^/.]+$/, "") : "Statement"
        setPdfAccountName(baseName || "Statement")
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
    }
  }

  const submitImport = async (dryRun: boolean) => {
    if (!selectedFile) {
      throw new Error("Please select a file to import")
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
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.error ?? "Import failed")
    }

    return (await response.json()) as ImportPreviewResponse | ImportResult
  }

  const handleNext = async () => {
    setError(null)

    if (step === "upload") {
      if (!selectedFile) {
        setError("Select a statement file to continue")
        return
      }
      if (fileKind === "pdf") {
        try {
          setIsProcessing(true)
          const previewResponse = (await submitImport(true)) as ImportPreviewResponse
          setPreview(previewResponse.preview)
          setPreviewTotal(previewResponse.total)
          setPreviewErrors(previewResponse.errors)
          setStep("preview")
        } catch (submitError) {
          setError(submitError instanceof Error ? submitError.message : "Failed to process file")
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
        setError("Please map the date, description, and amount columns")
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
        setError(submitError instanceof Error ? submitError.message : "Failed to process file")
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
        setError(importError instanceof Error ? importError.message : "Failed to import transactions")
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
          <DialogTitle>Import Transactions</DialogTitle>
          <DialogDescription>Upload a CSV or PDF statement from your bank or financial institution</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {renderError()}

          {step === "upload" && (
            <div className="space-y-4">
              <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="csv-file">Statement File</Label>
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
                    <CardTitle className="text-sm">Selected File</CardTitle>
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
                <div className="space-y-2">
                  <Label htmlFor="pdf-account-name">Account name</Label>
                  <Input
                    id="pdf-account-name"
                    value={pdfAccountName}
                    onChange={(event) => setPdfAccountName(event.target.value)}
                    disabled={isProcessing}
                  />
                  <p className="text-xs text-muted-foreground">
                    Transactions imported from this statement will use this account label.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === "mapping" && fileKind !== "pdf" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Map your CSV columns to transaction fields</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  { label: "Date Column", field: "date", required: true },
                  { label: "Description Column", field: "description", required: true },
                  { label: "Amount Column", field: "amount", required: true },
                  { label: "Category Column", field: "category", required: false },
                  { label: "Account Column", field: "account", required: false },
                  { label: "Status Column", field: "status", required: false },
                  { label: "Type Column", field: "type", required: false },
                  { label: "Notes Column", field: "notes", required: false },
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
                        <SelectValue placeholder={required ? "Select column" : optionalLabel} />
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
                  <h3 className="font-semibold">Preview Transactions</h3>
                  <p className="text-sm text-muted-foreground">Showing first {preview.length} of {previewTotal} rows</p>
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
                          {transaction.date} • {transaction.categoryName ?? "Uncategorized"}
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
                    <CardTitle className="text-sm">Skipped Rows</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {previewErrors.slice(0, 5).map((item, index) => (
                      <p key={index} className="text-xs text-muted-foreground">
                        Line {item.line}: {item.message}
                      </p>
                    ))}
                    {previewErrors.length > 5 && (
                      <p className="text-xs text-muted-foreground">{previewErrors.length - 5} more rows with issues.</p>
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
                <h3 className="text-lg font-semibold">Import complete</h3>
                <p className="text-sm text-muted-foreground">
                  {result.imported} transactions imported, {result.skipped} skipped
                </p>
              </div>
              {result.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Some rows were skipped:</p>
                  <div className="max-h-32 overflow-y-auto rounded-md border p-2 text-left text-xs">
                    {result.errors.map((item, index) => (
                      <p key={index}>
                        Line {item.line}: {item.message}
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
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
                Cancel
              </Button>
              <Button onClick={handleNext} disabled={isProcessing || (step === "upload" && !selectedFile)}>
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing
                  </>
                ) : step === "preview" ? (
                  "Import"
                ) : (
                  "Next"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
