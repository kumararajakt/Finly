import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  RotateCcw,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import type {
  CsvColumnMapping,
  CsvPreview,
  ImportResult,
  SignConvention,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_CSV_BYTES = 10 * 1024 * 1024;

const ROLE_LABELS: Record<string, string> = {
  date: "Date",
  merchant: "Description / merchant",
  amount: "Amount",
  debit: "Debit (money out)",
  credit: "Credit (money in)",
  category: "Category",
  account: "Account",
};

const REQUIRED_ROLES = ["date", "merchant"] as const;

function message(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

interface RoleSelectProps {
  role: string;
  value: number | null;
  onChange: (value: number | null) => void;
  preview: CsvPreview;
  required?: boolean;
  allowNone?: boolean;
}

function RoleSelect({
  role,
  value,
  onChange,
  preview,
  required = false,
  allowNone = false,
}: RoleSelectProps) {
  const samples = preview.sampleRows
    .map((row) => (value !== null ? row[value] : undefined))
    .filter((sample): sample is string => sample !== undefined && sample.trim().length > 0)
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium">
        {ROLE_LABELS[role] ?? role}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      <select
        value={value === null ? "" : String(value)}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === "" ? null : Number(raw));
        }}
        aria-label={ROLE_LABELS[role] ?? role}
        className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        {allowNone && <option value="">Not mapped</option>}
        {preview.headers.map((header, index) => (
          <option key={index} value={String(index)}>
            {header.trim() ? header.trim() : `Column ${index + 1}`}
          </option>
        ))}
        {preview.headers.length === 0 &&
          Array.from({ length: preview.columnCount }, (_, index) => (
            <option key={index} value={String(index)}>
              Column {index + 1}
            </option>
          ))}
      </select>
      {samples.length > 0 && (
        <p className="truncate text-xs text-muted-foreground">
          e.g.{" "}
          <span className="tabular-nums">
            {samples.map((sample) => `“${sample}”`).join(", ")}
          </span>
        </p>
      )}
    </div>
  );
}

function setRole(
  mapping: CsvColumnMapping,
  role: "date" | "merchant" | "amount" | "debit" | "credit" | "category" | "account",
  value: number | null
): CsvColumnMapping {
  return { ...mapping, [role]: value };
}

interface CsvImportCardProps {
  onNavigate: (page: string) => void;
}

function CsvImportCard({ onNavigate }: CsvImportCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"pick" | "mapping" | "result">("pick");
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string>("");
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [mapping, setMapping] = useState<CsvColumnMapping | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [signConvention, setSignConvention] =
    useState<SignConvention>("negative-expense");
  const [amountMode, setAmountMode] = useState<"amount" | "split">("amount");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    if (file.size > MAX_CSV_BYTES) {
      setError("That file is larger than 10 MB. Try a smaller statement export.");
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      const detected = await api.importCsv.preview(text);
      setCsvText(text);
      setPreview(detected);
      setMapping(detected.mapping);
      setHasHeader(detected.hasHeader);
      setAmountMode(
        detected.mapping.amount !== null ? "amount" : "split"
      );
      setStep("mapping");
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleMappingChange(
    role: "date" | "merchant" | "amount" | "debit" | "credit" | "category" | "account",
    value: number | null
  ) {
    if (!mapping) return;
    setMapping(setRole(mapping, role, value));
  }

  function switchAmountMode(mode: "amount" | "split") {
    if (!mapping || !preview) return;
    setAmountMode(mode);
    setMapping((current) => {
      if (!current) return current;
      if (mode === "amount") {
        const fallback = current.amount ?? current.debit ?? 2;
        return { ...current, debit: null, credit: null, amount: fallback };
      }
      const debit = current.debit ?? current.amount ?? 2;
      const credit =
        current.credit ??
        (debit + 1 < preview.columnCount ? debit + 1 : debit);
      return { ...current, amount: null, debit, credit };
    });
  }

  function mappingErrors(): string[] {
    if (!mapping || !preview) return [];
    const problems: string[] = [];
    for (const role of REQUIRED_ROLES) {
      if (mapping[role] === null || mapping[role] === undefined || mapping[role] >= preview.columnCount) {
        problems.push(ROLE_LABELS[role]);
      }
    }
    const hasAmount = mapping.amount !== null && mapping.amount !== undefined;
    const hasSplit =
      (mapping.debit !== null && mapping.debit !== undefined) ||
      (mapping.credit !== null && mapping.credit !== undefined);
    if (!hasAmount && !hasSplit) {
      problems.push("amount");
    }
    if (hasAmount && hasSplit) {
      problems.push("amount");
    }
    return problems;
  }

  async function handleImport() {
    if (!mapping || !preview) return;
    const problems = mappingErrors();
    if (problems.length > 0) {
      setError(`Map these columns before importing: ${problems.join(", ")}.`);
      return;
    }

    const payload = {
      date: mapping.date!,
      merchant: mapping.merchant!,
      amount: mapping.amount ?? undefined,
      debit: mapping.debit ?? undefined,
      credit: mapping.credit ?? undefined,
      category: mapping.category ?? undefined,
      account: mapping.account ?? undefined,
      hasHeader,
    };

    setBusy(true);
    setError(null);
    try {
      const outcome = await api.importCsv.run(csvText, payload, signConvention);
      setResult(outcome);
      setStep("result");
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStep("pick");
    setFileName(null);
    setCsvText("");
    setPreview(null);
    setMapping(null);
    setError(null);
    setResult(null);
  }

  if (step === "mapping" && preview && mapping) {
    const problems = mappingErrors();
    const unmapped = (preview.ambiguous ?? [])
      .map((role) => ROLE_LABELS[role] ?? role)
      .filter(Boolean);

    return (
      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <FileSpreadsheet className="size-4 text-muted-foreground" aria-hidden="true" />
              Map columns
            </h3>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {fileName} · {preview.rowCount} data row{preview.rowCount === 1 ? "" : "s"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setStep("pick")}>
            <ArrowLeft />
            Choose a different file
          </Button>
        </div>

        {unmapped.length > 0 && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              We couldn&apos;t auto-detect the {unmapped.join(", ")} column
              {unmapped.length === 1 ? "" : "s"}. Map them manually below.
            </span>
          </div>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <RoleSelect
            role="date"
            value={mapping.date}
            onChange={(value) => handleMappingChange("date", value)}
            preview={preview}
            required
          />
          <RoleSelect
            role="merchant"
            value={mapping.merchant}
            onChange={(value) => handleMappingChange("merchant", value)}
            preview={preview}
            required
          />

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-xs font-medium">Amount</span>
            <div className="flex flex-wrap gap-1.5">
              {(["amount", "split"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => switchAmountMode(mode)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    amountMode === mode
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  )}
                  aria-pressed={amountMode === mode}
                >
                  {mode === "amount" ? "Single amount column" : "Debit / Credit split"}
                </button>
              ))}
            </div>
          </div>

          {amountMode === "amount" ? (
            <RoleSelect
              role="amount"
              value={mapping.amount}
              onChange={(value) => handleMappingChange("amount", value)}
              preview={preview}
              required
            />
          ) : (
            <>
              <RoleSelect
                role="debit"
                value={mapping.debit}
                onChange={(value) => handleMappingChange("debit", value)}
                preview={preview}
                required
              />
              <RoleSelect
                role="credit"
                value={mapping.credit}
                onChange={(value) => handleMappingChange("credit", value)}
                preview={preview}
                required
              />
            </>
          )}

          <RoleSelect
            role="category"
            value={mapping.category}
            onChange={(value) => handleMappingChange("category", value)}
            preview={preview}
            allowNone
          />
          <RoleSelect
            role="account"
            value={mapping.account}
            onChange={(value) => handleMappingChange("account", value)}
            preview={preview}
            allowNone
          />
        </div>

        <div className="mt-5 grid gap-4 border-t pt-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">First row is a header</label>
            <input
              type="checkbox"
              checked={hasHeader}
              onChange={(event) => setHasHeader(event.target.checked)}
              className="size-4 self-start"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium">Sign convention</label>
            <select
              value={signConvention}
              onChange={(event) =>
                setSignConvention(event.target.value as SignConvention)
              }
              aria-label="Sign convention"
              className="w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="negative-expense">
                Negative = expense, positive = income
              </option>
              <option value="negative-income">
                Negative = income, positive = expense
              </option>
            </select>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-xs text-destructive">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            {problems.length === 0
              ? "Import runs duplicate detection — matching transactions are skipped."
              : `Missing: ${problems.join(", ")}.`}
          </p>
          <Button onClick={handleImport} disabled={busy || problems.length > 0}>
            <UploadCloud />
            {busy ? "Importing…" : "Import transactions"}
          </Button>
        </div>
      </section>
    );
  }

  if (step === "result" && result) {
    return (
      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
          <h3 className="text-sm font-medium">Import finished</h3>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <ResultStat label="Inserted" value={result.inserted} tone="default" />
          <ResultStat label="Duplicates skipped" value={result.duplicates} tone="muted" />
          <ResultStat label="Skipped" value={result.skipped} tone="muted" />
          <ResultStat label="Needs review" value={result.needsReview} tone="warning" />
        </div>
        {result.needsReview > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            {result.needsReview} transaction{result.needsReview === 1 ? "" : "s"} were imported
            without a recognized category and need review.
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
          <Button onClick={() => onNavigate("transactions")}>
            <FileSpreadsheet />
            View transactions
          </Button>
          <Button variant="outline" onClick={reset}>
            <RotateCcw />
            Import another file
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <FileSpreadsheet className="size-4 text-muted-foreground" aria-hidden="true" />
        Import a CSV statement
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose a bank statement export. We&apos;ll detect the columns first, then you confirm the
        mapping before anything is imported — nothing is guessed silently.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt,text/csv,text/plain"
        className="hidden"
        aria-label="Choose a CSV file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/50 disabled:opacity-50"
      >
        <FileUp className="size-6 text-muted-foreground" aria-hidden="true" />
        <span className="text-sm font-medium">
          {busy ? "Reading file…" : "Choose a CSV file"}
        </span>
        <span className="text-xs text-muted-foreground">
          Date, merchant and amount columns are detected automatically (max 10 MB)
        </span>
      </button>

      {error && (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

function ResultStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "muted" | "warning";
}) {
  return (
    <div className="rounded-lg border bg-background px-3 py-2.5">
      <p className="text-xl font-semibold tabular-nums">{value}</p>
      <p
        className={cn(
          "text-xs",
          tone === "warning"
            ? "text-amber-600 dark:text-amber-400"
            : "text-muted-foreground"
        )}
      >
        {label}
      </p>
    </div>
  );
}

export default function DocumentsPage({
  onNavigate = () => {},
}: {
  onNavigate?: (page: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Import</h2>
        <p className="text-sm text-muted-foreground">
          Import transactions from bank statement exports.
        </p>
      </div>

      <CsvImportCard onNavigate={onNavigate} />
    </div>
  );
}
