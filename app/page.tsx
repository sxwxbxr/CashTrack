import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SpendingTrendChart } from "@/components/charts/spending-trend-chart"
import { CategoryPieChart } from "@/components/charts/category-pie-chart"
import { Plus, TrendingUp, TrendingDown, DollarSign, CreditCard, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function DashboardPage() {
  return (
    <AppLayout
      title="Dashboard"
      description="Overview of your finances"
      action={
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Transaction
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Budget Alert */}
        <Alert className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-800 dark:text-orange-200">Budget Warning</AlertTitle>
          <AlertDescription className="text-orange-700 dark:text-orange-300">
            You've spent 85% of your monthly food budget. Consider reducing dining expenses.
          </AlertDescription>
        </Alert>

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$2,350.00</div>
              <p className="text-xs text-muted-foreground">+20.1% from last month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Income</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$4,200.00</div>
              <p className="text-xs text-muted-foreground">+5.2% from last month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$1,850.00</div>
              <p className="text-xs text-muted-foreground">-12.5% from last month</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Budget Remaining</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">$650.00</div>
              <p className="text-xs text-muted-foreground">32% of monthly budget</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Spending Trend</CardTitle>
              <CardDescription>Income vs expenses over the last 7 months</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <SpendingTrendChart />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Spending by Category</CardTitle>
              <CardDescription>Current month breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <CategoryPieChart />
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Your latest financial activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    name: "Grocery Store",
                    amount: -85.5,
                    category: "Food",
                    date: "Today",
                    description: "Weekly groceries",
                  },
                  {
                    name: "Salary Deposit",
                    amount: 2100.0,
                    category: "Income",
                    date: "Yesterday",
                    description: "Monthly salary",
                  },
                  {
                    name: "Gas Station",
                    amount: -45.2,
                    category: "Transport",
                    date: "2 days ago",
                    description: "Fuel",
                  },
                  {
                    name: "Coffee Shop",
                    amount: -12.5,
                    category: "Food",
                    date: "3 days ago",
                    description: "Morning coffee",
                  },
                  {
                    name: "Netflix",
                    amount: -15.99,
                    category: "Entertainment",
                    date: "5 days ago",
                    description: "Monthly subscription",
                  },
                ].map((transaction, index) => (
                  <div key={index} className="flex items-center justify-between border-b pb-4 last:border-b-0">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{transaction.name}</p>
                      <p className="text-xs text-muted-foreground">{transaction.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {transaction.category} • {transaction.date}
                      </p>
                    </div>
                    <div
                      className={`text-sm font-medium ${transaction.amount > 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {transaction.amount > 0 ? "+" : ""}${Math.abs(transaction.amount).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Budget Overview</CardTitle>
              <CardDescription>Monthly spending by category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { category: "Food", spent: 450, budget: 600, color: "bg-blue-500" },
                  { category: "Transport", spent: 280, budget: 300, color: "bg-green-500" },
                  { category: "Entertainment", spent: 120, budget: 200, color: "bg-yellow-500" },
                  { category: "Shopping", spent: 350, budget: 400, color: "bg-purple-500" },
                ].map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{item.category}</span>
                      <span className="text-muted-foreground">
                        ${item.spent} / ${item.budget}
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${item.color} ${
                          item.spent / item.budget > 0.8 ? "bg-red-500" : item.color
                        }`}
                        style={{ width: `${Math.min((item.spent / item.budget) * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {((item.spent / item.budget) * 100).toFixed(0)}% used
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
