import { useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Transaction = {
  date: string
  type: "debit" | "credit"
  detail: string
  amount: number
  category: string
  notes: string
  account: string
}

const defaultTransactions: Transaction[] = [
  { date: "2026-07-30", type: "debit", detail: "Grocery Store", amount: 85.50, category: "Food", notes: "Weekly groceries", account: "Checking" },
  { date: "2026-07-29", type: "credit", detail: "Salary Deposit", amount: 3500.00, category: "Income", notes: "Monthly salary", account: "Checking" },
  { date: "2026-07-28", type: "debit", detail: "Electric Bill", amount: 120.00, category: "Utilities", notes: "July bill", account: "Checking" },
  { date: "2026-07-27", type: "debit", detail: "Amazon Purchase", amount: 45.99, category: "Shopping", notes: "Books", account: "Credit Card" },
  { date: "2026-07-26", type: "credit", detail: "Freelance Payment", amount: 750.00, category: "Income", notes: "Web dev project", account: "Savings" },
]

export default function TransactionPage({ addEntrySignal }: { addEntrySignal?: number }) {
  const [transactions, setTransactions] = useState(defaultTransactions)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Transaction>({
    date: "", type: "debit", detail: "", amount: 0, category: "", notes: "", account: "",
  })

  useEffect(() => {
    if (addEntrySignal && addEntrySignal > 0) {
      setOpen(true)
    }
  }, [addEntrySignal])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.date || !form.detail || !form.category || !form.account || form.amount <= 0) return
    setTransactions([form, ...transactions])
    setForm({ date: "", type: "debit", detail: "", amount: 0, category: "", notes: "", account: "" })
    setOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-sm text-muted-foreground">Manage your financial transactions</p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button><Plus /> Add Transaction</Button>} />
          <SheetContent side="right" className="sm:max-w-md">
            <form onSubmit={handleSubmit}>
              <SheetHeader>
                <SheetTitle>Add Transaction</SheetTitle>
                <SheetDescription>Fill in the details to add a new transaction.</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium">Date</label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium">Type</label>
                  <select
                    className="flex h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as "debit" | "credit" })}
                  >
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium">Transaction Detail</label>
                  <Input value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} placeholder="e.g. Grocery Store" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium">Amount</label>
                  <Input type="number" step="0.01" min="0" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} placeholder="0.00" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium">Category</label>
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Food, Income" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium">Notes</label>
                  <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium">Account</label>
                  <Input value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })} placeholder="e.g. Checking" required />
                </div>
              </div>
              <SheetFooter>
                <Button type="submit">Save Transaction</Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Transaction Detail</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Account</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx, i) => (
              <TableRow key={i}>
                <TableCell>{tx.date}</TableCell>
                <TableCell>
                  <span className={tx.type === "credit" ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
                    {tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}
                  </span>
                </TableCell>
                <TableCell>{tx.detail}</TableCell>
                <TableCell className="font-mono">{tx.type === "credit" ? "+" : "-"}${tx.amount.toFixed(2)}</TableCell>
                <TableCell>{tx.category}</TableCell>
                <TableCell className="text-muted-foreground">{tx.notes}</TableCell>
                <TableCell>{tx.account}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
