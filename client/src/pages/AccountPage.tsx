import { useState } from "react"
import { Building2, CreditCard, PiggyBank, Plus, Wallet } from "lucide-react"
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
import { cn } from "@/lib/utils"

type Account = {
  name: string
  type: string
  balance: number
  description: string
}

const typeConfig: Record<string, { icon: typeof Wallet; color: string }> = {
  checking: { icon: Wallet, color: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-500/20" },
  savings: { icon: PiggyBank, color: "text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/20" },
  credit: { icon: CreditCard, color: "text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-500/20" },
  investment: { icon: Building2, color: "text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-500/20" },
}

export default function AccountPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<Account>({ name: "", type: "checking", balance: 0, description: "" })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.type) return
    setAccounts([form, ...accounts])
    setForm({ name: "", type: "checking", balance: 0, description: "" })
    setOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Accounts</h1>
          <p className="text-sm text-muted-foreground">Manage your financial accounts</p>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button><Plus /> Add Account</Button>} />
          <SheetContent side="right" className="sm:max-w-md">
            <form onSubmit={handleSubmit}>
              <SheetHeader>
                <SheetTitle>Add Account</SheetTitle>
                <SheetDescription>Fill in the details to create a new account.</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium">Account Name</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Checking" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium">Type</label>
                  <select
                    className="flex h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                  >
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                    <option value="credit">Credit</option>
                    <option value="investment">Investment</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium">Balance</label>
                  <Input type="number" step="0.01" value={form.balance || ""} onChange={(e) => setForm({ ...form, balance: parseFloat(e.target.value) || 0 })} placeholder="0.00" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium">Description</label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
                </div>
              </div>
              <SheetFooter>
                <Button type="submit">Save Account</Button>
              </SheetFooter>
            </form>
          </SheetContent>
        </Sheet>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.length === 0 ? (
          <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
            No accounts yet. Add one to get started.
          </p>
        ) : (
          accounts.map((account, i) => {
          const config = typeConfig[account.type] ?? { icon: Wallet, color: "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-500/20" }
          const Icon = config.icon
          return (
            <div key={i} className="rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div className={cn("flex size-10 items-center justify-center rounded-lg", config.color)}>
                  <Icon className="size-5" />
                </div>
                <span className={cn(
                  "font-mono text-lg font-semibold",
                  account.balance >= 0 ? "text-foreground" : "text-red-600 dark:text-red-400"
                )}>
                  ${account.balance.toFixed(2)}
                </span>
              </div>
              <div className="mt-3">
                <h3 className="font-medium">{account.name}</h3>
                <p className="text-xs capitalize text-muted-foreground">{account.type}</p>
              </div>
              {account.description && (
                <p className="mt-2 text-sm text-muted-foreground">{account.description}</p>
              )}
            </div>
          )
        })
        )}
      </div>
    </div>
  )
}
