# Investments Feature Plan

Single-user tracking of investment accounts for Finly: buy/sell/dividend lots, a dedicated
Investments page with per-account mini-ledgers, live-ish quotes, and net worth computed from
real account balances instead of the manual "Not set" card.

## Goal

- Treat a savings → investment transfer as an **investment** (asset movement), never an expense.
- New `investment` transaction type + investment account type.
- Buy: units/quantity, price per unit, amount, fund/stock name.
- Sell: same fields, plus realized gain/loss.
- Dividend / Interest: counts as Income, hits the savings account.
- Net Worth = (Savings + Investments) − (Credit card + Loans), computed from accounts — a manual
  setting no longer.

## Key design decisions (resolved)

1. **Two-sided cash legs.** A buy is not one row — it's a `trades` lot **plus** a `transactions`
   row on the funding (savings) account with `type = 'investment'`. The savings ledger shows
   money leaving as *investment* (neutral, not an expense); the `trades` table holds units/price.
   Matches "transfer to an asset account, not an expense."
2. **New `type = 'investment'`.** Extend the `TransactionType` union and the DB check constraint.
   Excluded from spending/income in the summary (like `transfer` today). `summary.service.ts`
   and `budgets.service.ts` already filter by `type`, so they're naturally safe.
3. **Accounts get a `type`**: `cash | credit | investment`. Classifies accounts for net worth
   and lets the Investments page list investment accounts.
4. **Transfers upgrade to from/to (double-entry) now.** Being done as part of this work, while
   the code is already being touched. A single-leg transfer leaves the counterparty account's
   balance wrong or needs a second manual entry — exactly the bug this feature fixes. Rename the
   `transactions.account` column to `fromAccount` and add nullable `toAccount`. Income/expense:
   only `fromAccount` set. Transfer / investment buy: both set.
5. **Cost basis = average cost (AVCO)** per (account, security). Simple and standard; FIFO is a
   future option.
6. **Pricing: manual entry + optional live quotes** (see Quotes below). Manual price stays the
   base; a "Fetch price" button fills it from a provider; a per-security "current price"
   override is stored.
7. **Net worth: 100% computed from accounts, with one escape hatch.** Net worth = Σ(Savings +
   Investments) − Σ(Credit + Loans) is the real calculation. A single optional **"Other
   assets/liabilities" adjustment** field (gold, property, EPF, an untracked loan) covers
   anything you don't want to model as a full account. Replaces `totalAssets` /
   `totalLiabilities` / `netWorthConfigured`.
8. **One investment code path, two entry points.** The Buy/Sell/Dividend form is a shared
   component used by the Investments page **and** the Add entry form (a "Transfer → Investment"
   shortcut opens the same mini-form). Prevents investment transactions that don't reconcile
   against holdings.

## Live quotes landscape (India, NSE/BSE)

NSE/BSE have no official free real-time API. Free options are unofficial scraping or
delayed/EOD data. Chosen providers — zero cost, no key management, and no Vercel IP issues:

- **Stocks: `yahoo-finance2` (npm)** — unofficial but the most reliable for a solo project.
  Covers NSE/BSE symbols (`RELIANCE.NS`, `WIPRO.NS`), no key needed, live-ish price + OHLC.
  Runs fine on Vercel serverless (pure HTTPS to `query1.finance.yahoo.com`, which doesn't
  block cloud IPs).
- **Mutual funds: AMFI NAV API** — official, free, no key. Parse
  `https://www.amfiindia.com/spages/NAVAll.txt`, updated once daily after market close.

Avoid `stock-nse-india` (npm): it wraps NSE's own endpoints, which actively block
datacenter/cloud IPs — it will fail on Vercel even if it works locally. Twelve Data's free tier
covers India but is rate-capped (8 req/min) — fine for occasional refresh, not polling.

Provider abstraction behind one `GET /api/investments/quote?q=RELIANCE.NS` endpoint so a source
can be swapped later.

## Credit cards (goal + implementation)

### Goal

- Credit cards become first-class accounts: a `credit` account type alongside cash.
- **Outstanding balance is derived, never typed in.** Expenses charged on a card accumulate
  outstanding; a payment clears it. Net worth then reflects the true liability automatically.
- The generic Add entry form, transfers, budgets, and the summary all work for credit cards
  without card-specific special cases.

### How it works

- **Outstanding = Σ card expenses − Σ payments.** Two pieces of existing machinery make this
  free: account `type = 'credit'` (classifies the account) and the from/to transfer upgrade
  (models a payment). No new `outstanding` column, no reconciliation step.
- **Sign convention stays "positive magnitude".** The stored amount is always positive; the
  *direction* comes from the row's type/side. A card account's computed balance reads negative
  (= liability, i.e. "you owe this much"). Rendering flips it to positive "outstanding" in the
  UI, exactly like the red balance on a credit card.
- **Paying the card = a transfer** from a cash account → the card account. This is why the
  single-leg transfer bug gets fixed in the same release — without from/to you literally can't
  record a payment, so card debt can never be derived. Because a transfer moves money *within*
  your net worth, it doesn't change net worth: cash goes down, liability goes down.
- **Balance computation** (shared with investments):
  - expense on a card → `−amount` on the card's balance (outstanding grows);
  - transfer cash → card → `+amount` on the card (outstanding shrinks) and `−amount` on cash;
  - refund / credit on a card → `income` on the card (outstanding shrinks).

### Server changes

- `accounts.dto.ts` / `accounts.service.ts`: accept `type` (`cash | credit | investment`) on
  create; default `cash`; keep the historical-label convention (deleting an account leaves the
  label on transactions).
- Per-account balance report (new endpoint or part of summary): for each account,
  `balance = Σ into − Σ out`, credit accounts returned as a positive `outstanding` +
  liability flag.
- Net worth (`summary.service.ts`): subtract Σ credit outstanding (already in the formula
  below). No special-casing — it falls out of account type.
- Transfer `transactions` rows: validate that a transfer's `fromAccount`/`toAccount` aren't the
  same and are both set; no net-worth impact.

### Client changes

- **Accounts page** (`AccountPage.tsx` is currently a disconnected prototype — wire it up to
  `api.accounts.*` and replace the plain name-list in `SettingsPage.tsx:715`; add to
  `utils/menu.ts` + `App.tsx`). Cards render with a red balance, `outstanding` label, and the
  credit icon; cash accounts green.
  - Account create form gains the type picker (checking / savings / credit / investment) —
    `AccountPage.tsx` already sketches this; the prototype's `balance` input is removed (it's
    derived) and `$` hardcoding dropped (app uses `Intl` via `formatCurrency`).
- **Transfer form**: from/to account pickers (in the Add entry sheet + anywhere transfers are
  created); the "pay credit card" flow is just `from: cash → to: card`.
- **Transactions page**: filter/group by account type; a card account's expenses show the
  credit-card badge; amounts on a card render as liabilities.
- **Dashboard / Settings**: net worth card already shows the `credit` breakdown bucket; Settings
  net-worth section keeps only the "Other assets/liabilities" adjustment.

### Out of scope (v1)

Statement/cycle tracking, due dates, interest billing, reward points, EMI/conversion
segmentation — a personal tracker doesn't need them. The derived outstanding + from/to payment
flow covers the real need: knowing what you owe and that it's reflected in net worth.

### Rollout

Folds into the existing phases — account `type` in phase 1 (schema/migration), from/to transfers
+ per-account balances in phase 2 (server), Accounts page + transfer UI in phase 3 (client).
The investment and credit-card work share the same foundation (account types, from/to legs,
computed balances), so they ship together rather than as separate migrations.

## Data model (`server/src/database/schema.ts`)

- `accounts`: add `type text not null default 'cash'` + check constraint
  (`cash | credit | investment`). Migration backfills existing rows to `cash`.
- `transactions`:
  - rename `account` → `fromAccount`;
  - add nullable `toAccount` (set for transfers and investment buys);
  - widen the `type` check to include `'investment'`;
  - add nullable `side` (`buy | sell | dividend | interest`) used only for `investment` rows —
    keeps the "positive magnitude, sign lives elsewhere" convention while letting the ledger
    render direction.
- New `trades` table (source of truth for the mini-ledger):
  `id, userId→users, accountId→accounts, date, security, side, units, price, amount, fee,
  linkedTransactionId→transactions, notes, createdAt` + check on `side`.
- New `securities` table: `userId, name, currentPrice, updatedAt` (composite PK) — manual
  current-price overrides.
- New `quotes` cache table: `symbol, source, name, price, fetchedAt` — caches provider
  responses so serverless invocations don't hammer the upstream (short TTL, e.g. 5 min for
  stocks, 1 day for AMFI NAVs).

Positions (units, avg cost, cost basis, realized P/L) are **computed from `trades`** in the
service — no denormalized table to keep consistent.

## Server changes

### New `server/src/investments/` module

| Endpoint | Purpose |
| --- | --- |
| `POST /api/investments/trades` | Buy / sell / dividend. Atomically (DB transaction): insert the cash-leg `transactions` row (`type='investment'`, `side`, `fromAccount` = funding account, merchant = security, fingerprint via `computeFingerprint`) **and** the linked `trades` row. Sells compute realized P/L from remaining AVCO lots. Duplicate guard → 409. |
| `GET /api/investments/positions?accountId=` | Per-account holdings: security, units, avgCost, costBasis, currentPrice, marketValue, unrealized P/L. |
| `GET /api/investments/trades?accountId=` | Mini-ledger for one investment account. |
| `GET /api/investments/quote?q=` | Live-ish quote. `yahoo-finance2` for stocks, AMFI NAVAll.txt for MFs, cached via `quotes` table. |
| `PATCH /api/investments/securities/:name` | Update the manual current-price override. |
| `GET /api/investments/summary` | Total invested (cost), market value, realized + unrealized P/L. |

### Transfers (from/to)

- `transactions.dto.ts` + service: accept `toAccount`; migrate the UI and existing rows
  (`account` → `fromAccount`).
- Balance computation reads both columns (see below).

### Net worth (`summary.service.ts` + settings)

- Compute per-account cash balances using both legs:
  - `income` / `investment sell` / transfer-into → `+amount` on the receiving account;
  - `expense` / `investment buy` / transfer-out → `−amount` on the source account
    (expenses on credit accounts become positive "outstanding").
- Net worth = Σ cash balances + Σ investment market values − Σ credit/loan outstanding
  **+ the single "Other assets/liabilities" adjustment**.
- Return a breakdown (`cash`, `investments`, `credit`, `other`) for the Dashboard card;
  `netWorth` is no longer `null` when unconfigured. Settings keys
  `totalAssets` / `totalLiabilities` / `netWorthConfigured` are replaced by the one adjustment.

### Small touches

- Transactions DTO allows `investment` in `type` / type filter.
- Seed an "Investments" category in `database-seed.service.ts`.
- Type labels + signed-amount rendering for `investment` (client).

## Client changes

- **`InvestmentsPage`** (`/investments`; added to `utils/menu.ts`, `App.tsx` page map,
  `MobileBottomNav`):
  - Summary strip: invested, market value, total P/L, per-account chips.
  - Positions table: units, avg cost, current price (inline-editable → `PATCH securities`, with
    a "Fetch quote" action), market value, unrealized P/L, weight.
  - Buy / Sell / Dividend sheet (shared component): investment account, funding account (cash
    only), date, security, units, price, fee; amount auto-calc; sell shows realized P/L
    preview; "Fetch quote" fills the price.
  - Mini-ledger per investment account: date, side, security, units, price, amount, fee,
    realized P/L.
- **Transactions page**: add `investment` to the type filter + labels; render investment rows
  neutrally (with a badge) like transfers. Transfer form gains from/to account pickers.
- **Add entry form**: "Transfer → Investment" shortcut opens the same buy/sell mini-form —
  one code path, two entry points.
- **Dashboard**: Net Worth card switches to the computed value with a breakdown strip; add an
  Investments mini-card (market value + P/L).
- **Settings**: net worth section becomes the single "Other assets/liabilities" adjustment;
  accounts get a type picker on create/edit.

## Impact on existing features

- Summary / cash-flow / budgets / detection already filter by `type`, so `investment` rows are
  excluded automatically — verify each with a test.
- The `account` → `fromAccount` rename ripples through `transactions.service.ts`, the summary,
  CSV import, detection, and every client reference — plan for a migration + test sweep.
- CSV / PDF import stays expense/income only; investment entries come from the Investments page
  or the Add entry shortcut.

## Rollout phases

1. **Schema + migration**: account types, `fromAccount`/`toAccount` rename, transaction
   type/side, `trades` + `securities` + `quotes` tables, settings key swap.
2. **Server module**: trades CRUD, positions/summary computation, AVCO realized P/L, quote
   provider (yahoo-finance2 + AMFI) with caching, transfers from/to, net worth computation +
   tests (Jest unit; e2e optional).
3. **Client**: Investments page, shared Buy/Sell/Dividend form, transactions + transfer UI,
   dashboard net worth card.
4. **Polish**: quote refresh, per-account balances UI, backfill helper for mis-recorded
   savings → investment "expenses".

## Risks / notes

- `yahoo-finance2` is unofficial — schema can shift; keep the provider abstraction and the
  manual price override as the fallback.
- AMFI data is once-daily EOD; mutual-fund prices never update intraday.
- Vercel serverless: quote caching in the DB matters — each cold invocation has no in-memory
  cache to lean on.
