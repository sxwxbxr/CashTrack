"use client"

import type React from "react"

import { useState } from "react"
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
import { FileText, CheckCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface TransactionImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TransactionImportDialog({ open, onOpenChange }: TransactionImportDialogProps) {
  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "success">("upload")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [bankFormat, setBankFormat] = useState("")

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleNext = () => {
    if (step === "upload" && selectedFile) {
      setStep("mapping")
    } else if (step === "mapping") {
      setStep("preview")
    } else if (step === "preview") {
      setStep("success")
    }
  }

  const handleClose = () => {
    setStep("upload")
    setSelectedFile(null)
    setBankFormat("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Import Transactions</DialogTitle>
          <DialogDescription>Upload a CSV file from your bank or financial institution</DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="csv-file">CSV File</Label>
              <Input id="csv-file" type="file" accept=".csv" onChange={handleFileSelect} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank-format">Bank Format (Optional)</Label>
              <Select value={bankFormat} onValueChange={setBankFormat}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your bank format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chase">Chase Bank</SelectItem>
                  <SelectItem value="bofa">Bank of America</SelectItem>
                  <SelectItem value="wells">Wells Fargo</SelectItem>
                  <SelectItem value="citi">Citibank</SelectItem>
                  <SelectItem value="generic">Generic CSV</SelectItem>
                </SelectContent>
              </Select>
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
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">Map your CSV columns to transaction fields</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date Column</Label>
                <Select defaultValue="date">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="transaction_date">Transaction Date</SelectItem>
                    <SelectItem value="posting_date">Posting Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description Column</Label>
                <Select defaultValue="description">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="description">Description</SelectItem>
                    <SelectItem value="memo">Memo</SelectItem>
                    <SelectItem value="payee">Payee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount Column</Label>
                <Select defaultValue="amount">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amount">Amount</SelectItem>
                    <SelectItem value="debit">Debit</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category Column (Optional)</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="category">Category</SelectItem>
                    <SelectItem value="type">Type</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Preview of transactions to be imported (showing first 5)
            </div>
            <div className="rounded-md border">
              <div className="p-4 space-y-2">
                {[
                  { date: "2024-01-15", description: "GROCERY STORE", amount: -85.5 },
                  { date: "2024-01-14", description: "PAYROLL DEPOSIT", amount: 2100.0 },
                  { date: "2024-01-13", description: "GAS STATION", amount: -45.2 },
                  { date: "2024-01-12", description: "COFFEE SHOP", amount: -12.5 },
                  { date: "2024-01-11", description: "NETFLIX", amount: -15.99 },
                ].map((transaction, index) => (
                  <div key={index} className="flex justify-between items-center py-2 border-b last:border-b-0">
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <p className="text-sm text-muted-foreground">{transaction.date}</p>
                    </div>
                    <span className={`font-medium ${transaction.amount > 0 ? "text-green-600" : "text-red-600"}`}>
                      {transaction.amount > 0 ? "+" : ""}${Math.abs(transaction.amount).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Total: 47 transactions will be imported</p>
          </div>
        )}

        {step === "success" && (
          <div className="text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
            <div>
              <h3 className="text-lg font-semibold">Import Successful!</h3>
              <p className="text-muted-foreground">47 transactions have been imported successfully</p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "success" ? (
            <Button onClick={handleClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleNext} disabled={step === "upload" && !selectedFile}>
                {step === "preview" ? "Import" : "Next"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
