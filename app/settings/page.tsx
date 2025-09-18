"use client"

import { useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Save,
  Download,
  Upload,
  Trash2,
  Plus,
  Database,
  Shield,
  Bell,
  Palette,
  Globe,
  CreditCard,
  FileText,
  AlertTriangle,
} from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    currency: "USD",
    dateFormat: "MM/DD/YYYY",
    theme: "system",
    notifications: {
      budgetAlerts: true,
      weeklyReports: true,
      monthlyReports: true,
      transactionReminders: false,
    },
    privacy: {
      dataEncryption: true,
      autoBackup: true,
      shareAnalytics: false,
    },
  })

  const handleSave = () => {
    console.log("Saving settings:", settings)
    // Implementation would go here
  }

  const handleExportData = () => {
    console.log("Exporting all data")
    // Implementation would go here
  }

  const handleImportData = () => {
    console.log("Importing data")
    // Implementation would go here
  }

  return (
    <AppLayout
      title="Settings"
      description="Manage your account and application preferences"
      action={
        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      }
    >
      <div className="space-y-6">
        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="data-sources">Data Sources</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
            <TabsTrigger value="backup">Backup</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Regional Settings
                </CardTitle>
                <CardDescription>Configure your regional preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={settings.currency}
                      onValueChange={(value) => setSettings({ ...settings, currency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="JPY">JPY (¥)</SelectItem>
                        <SelectItem value="CAD">CAD (C$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date-format">Date Format</Label>
                    <Select
                      value={settings.dateFormat}
                      onValueChange={(value) => setSettings({ ...settings, dateFormat: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Appearance
                </CardTitle>
                <CardDescription>Customize the look and feel of the application</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select value={settings.theme} onValueChange={(value) => setSettings({ ...settings, theme: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="data-sources" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Connected Accounts
                </CardTitle>
                <CardDescription>Manage your connected bank accounts and financial institutions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {[
                    { name: "Chase Checking", type: "Bank Account", status: "Connected", lastSync: "2 hours ago" },
                    { name: "Chase Credit Card", type: "Credit Card", status: "Connected", lastSync: "2 hours ago" },
                    { name: "Savings Account", type: "Bank Account", status: "Disconnected", lastSync: "5 days ago" },
                  ].map((account, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          <span className="font-medium">{account.name}</span>
                          <Badge variant={account.status === "Connected" ? "default" : "secondary"}>
                            {account.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {account.type} • Last sync: {account.lastSync}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          Sync Now
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Connect New Account
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>CSV Import Templates</CardTitle>
                <CardDescription>Manage templates for importing CSV files from different banks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {[
                    { name: "Chase Bank Template", columns: "Date, Description, Amount, Balance", active: true },
                    { name: "Bank of America Template", columns: "Date, Payee, Amount, Type", active: true },
                    { name: "Wells Fargo Template", columns: "Date, Description, Debit, Credit", active: false },
                  ].map((template, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="font-medium">{template.name}</span>
                          <Badge variant={template.active ? "default" : "secondary"}>
                            {template.active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">Columns: {template.columns}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full bg-transparent">
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Template
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Preferences
                </CardTitle>
                <CardDescription>Choose what notifications you want to receive</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="budget-alerts">Budget Alerts</Label>
                      <p className="text-sm text-muted-foreground">Get notified when you exceed budget limits</p>
                    </div>
                    <Switch
                      id="budget-alerts"
                      checked={settings.notifications.budgetAlerts}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          notifications: { ...settings.notifications, budgetAlerts: checked },
                        })
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="weekly-reports">Weekly Reports</Label>
                      <p className="text-sm text-muted-foreground">Receive weekly spending summaries</p>
                    </div>
                    <Switch
                      id="weekly-reports"
                      checked={settings.notifications.weeklyReports}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          notifications: { ...settings.notifications, weeklyReports: checked },
                        })
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="monthly-reports">Monthly Reports</Label>
                      <p className="text-sm text-muted-foreground">Receive detailed monthly financial reports</p>
                    </div>
                    <Switch
                      id="monthly-reports"
                      checked={settings.notifications.monthlyReports}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          notifications: { ...settings.notifications, monthlyReports: checked },
                        })
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="transaction-reminders">Transaction Reminders</Label>
                      <p className="text-sm text-muted-foreground">
                        Reminders to categorize uncategorized transactions
                      </p>
                    </div>
                    <Switch
                      id="transaction-reminders"
                      checked={settings.notifications.transactionReminders}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          notifications: { ...settings.notifications, transactionReminders: checked },
                        })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Privacy & Security
                </CardTitle>
                <CardDescription>Manage your privacy and security settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="data-encryption">Data Encryption</Label>
                      <p className="text-sm text-muted-foreground">Encrypt sensitive financial data</p>
                    </div>
                    <Switch
                      id="data-encryption"
                      checked={settings.privacy.dataEncryption}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          privacy: { ...settings.privacy, dataEncryption: checked },
                        })
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto-backup">Automatic Backups</Label>
                      <p className="text-sm text-muted-foreground">Automatically backup your data weekly</p>
                    </div>
                    <Switch
                      id="auto-backup"
                      checked={settings.privacy.autoBackup}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          privacy: { ...settings.privacy, autoBackup: checked },
                        })
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="share-analytics">Share Anonymous Analytics</Label>
                      <p className="text-sm text-muted-foreground">Help improve CashTrack by sharing usage data</p>
                    </div>
                    <Switch
                      id="share-analytics"
                      checked={settings.privacy.shareAnalytics}
                      onCheckedChange={(checked) =>
                        setSettings({
                          ...settings,
                          privacy: { ...settings.privacy, shareAnalytics: checked },
                        })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800 dark:text-yellow-200">Security Notice</AlertTitle>
              <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                Your financial data is encrypted and stored securely. We never share your personal financial information
                with third parties.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="backup" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Data Backup & Restore</CardTitle>
                <CardDescription>Backup your data or restore from a previous backup</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Export Data</CardTitle>
                      <CardDescription>Download all your financial data</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button onClick={handleExportData} className="w-full">
                        <Download className="mr-2 h-4 w-4" />
                        Export All Data
                      </Button>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Import Data</CardTitle>
                      <CardDescription>Restore from a backup file</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button onClick={handleImportData} variant="outline" className="w-full bg-transparent">
                        <Upload className="mr-2 h-4 w-4" />
                        Import Backup
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Recent Backups</h4>
                  <div className="space-y-3">
                    {[
                      { date: "2024-01-15", size: "2.4 MB", type: "Automatic" },
                      { date: "2024-01-08", size: "2.3 MB", type: "Automatic" },
                      { date: "2024-01-01", size: "2.1 MB", type: "Manual" },
                    ].map((backup, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="space-y-1">
                          <p className="font-medium">{backup.date}</p>
                          <p className="text-sm text-muted-foreground">
                            {backup.size} • {backup.type} backup
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}
