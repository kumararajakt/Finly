import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  FileSpreadsheet,
  FileUp,
  Plus,
  RotateCcw,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import { useSettings } from "@/contexts/SettingsContext";
import { formatDate, formatSignedAmount } from "@/lib/format";
import type {
  CsvColumnMapping,
  CsvImportPreview,
  CsvMapping,
  CsvPreview,
  ImportResult,
  SignConvention,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_CSV_BYTES = 20 * 1024 * 1024;
const MAX_PREVIEW_ROWS = 500;

const ROLE_LABELS: Record<string, string> = {
  date: "Date",
  merchant: "Description / merchant",
  amount: "Amount",
  debit: "Debit (money out)",
  credit: "Credit (money in)",
  category: "Category",
  account: "Account",
  notes: "Notes",
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

type MappingRole =
  | "date"
  | "merchant"
  | "amount"
  | "debit"
  | "credit"
  | "category"
  | "account"
  | "notes";

function setRole(
  mapping: CsvColumnMapping,
  role: MappingRole,
  value: number | null
): CsvColumnMapping {
  return { ...mapping, [role]: value };
}

interface CsvImportCardProps {
  onNavigate?: (page: string) => void;
  onImported?: (result: ImportResult) => void;
}

export default function CsvImportCard({ onNavigate, onImported }: CsvImportCardProps) {
  const { settings } = useSettings();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"pick" | "mapping" | "preview" | "result">(
    "pick"
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string>("");
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [mapping, setMapping] = useState<CsvColumnMapping | null>(null);
  const [importPreview, setImportPreview] = useState<CsvImportPreview | null>(
    null
  );
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
      setError("That file is larger than 20 MB. Try a smaller statement export.");
      return;
    }
    setBusy(true);
    try {
      if (file.name.toLowerCase().endsWith(".pdf")) {
        const extracted = await api.importPdf.extract(file);
        setCsvText(extracted.csv);
        setFileName(extracted.filename);
        const detected = await api.importCsv.preview(extracted.csv);
        setPreview(detected);
        setMapping(detected.mapping);
        setHasHeader(detected.hasHeader);
        setAmountMode(
          detected.mapping.amount !== null ? "amount" : "split"
        );
        setStep("mapping");
        return;
      }
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
    role: MappingRole,
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

  function importPayload(): CsvMapping | null {
    if (!mapping) return null;
    const problems = mappingErrors();
    if (problems.length > 0) {
      setError(`Map these columns before importing: ${problems.join(", ")}.`);
      return null;
    }
    return {
      date: mapping.date,
      merchant: mapping.merchant,
      amount: mapping.amount ?? undefined,
      debit: mapping.debit ?? undefined,
      credit: mapping.credit ?? undefined,
      category: mapping.category ?? undefined,
      account: mapping.account ?? undefined,
      notes: mapping.notes ?? undefined,
      hasHeader,
    };
  }

  async function handlePreviewImport() {
    const payload = importPayload();
    if (!payload) return;

    setBusy(true);
    setError(null);
    try {
      const data = await api.importCsv.previewRows(
        csvText,
        payload,
        signConvention
      );
      setImportPreview(data);
      setStep("preview");
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    const payload = importPayload();
    if (!payload) return;

    setBusy(true);
    setError(null);
    try {
      const outcome = await api.importCsv.run(csvText, payload, signConvention);
      setResult(outcome);
      setStep("result");
      onImported?.(outcome);
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
    setImportPreview(null);
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
          <RoleSelect
            role="notes"
            value={mapping.notes}
            onChange={(value) => handleMappingChange("notes", value)}
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
              ? "You'll review every row before anything is imported."
              : `Missing: ${problems.join(", ")}.`}
          </p>
          <Button
            onClick={handlePreviewImport}
            disabled={busy || problems.length > 0}
          >
            <Eye />
            {busy ? "Preparing preview…" : "Preview import"}
          </Button>
        </div>
      </section>
    );
  }

  if (step === "preview" && importPreview) {
    const { inserted, duplicates, skipped, needsReview, totalRows } =
      importPreview;
    const visible = importPreview.rows.slice(0, MAX_PREVIEW_ROWS);
    const truncated = importPreview.rows.length > MAX_PREVIEW_ROWS;

    const newCategoryNote =
      importPreview.newCategories.length > 0
        ? `${importPreview.newCategories.length} categor${
            importPreview.newCategories.length === 1 ? "y" : "ies"
          } (${importPreview.newCategories.join(", ")})`
        : null;
    const newAccountNote =
      importPreview.newAccounts.length > 0
        ? `${importPreview.newAccounts.length} account${
            importPreview.newAccounts.length === 1 ? "" : "s"
          } (${importPreview.newAccounts.join(", ")})`
        : null;
    const createdNote = [newCategoryNote, newAccountNote]
      .filter(Boolean)
      .join(" and ");

    return (
      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <Eye className="size-4 text-muted-foreground" aria-hidden="true" />
              Review before import
            </h3>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {fileName} · {totalRows} data row{totalRows === 1 ? "" : "s"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStep("mapping")}
            disabled={busy}
          >
            <ArrowLeft />
            Back to mapping
          </Button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <ResultStat label="Will be imported" value={inserted} tone="default" />
          <ResultStat label="Duplicates skipped" value={duplicates} tone="muted" />
          <ResultStat label="Invalid rows" value={skipped} tone="muted" />
          <ResultStat label="Needs review" value={needsReview} tone="warning" />
        </div>

        {needsReview > 0 && (
          <p
            role="alert"
            className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              {needsReview} row{needsReview === 1 ? "" : "s"} won&apos;t have a
              recognized category and will be marked “Needs review”.
            </span>
          </p>
        )}

        {createdNote && (
          <p
            role="status"
            className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"
          >
            <Plus className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>Will also create {createdNote}.</span>
          </p>
        )}

        <div className="mt-4 overflow-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-muted/50">
              <tr className="text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Merchant</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Category</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Account</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((row, index) => (
                <tr
                  key={index}
                  className={cn(
                    row.status === "skipped" && "text-muted-foreground"
                  )}
                >
                  <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">
                    {formatDate(row.date)}
                  </td>
                  <td className="max-w-[16rem] truncate px-3 py-1.5">
                    {row.merchant || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                    {row.amount > 0
                      ? formatSignedAmount(row.amount, row.type, settings.currency)
                      : "—"}
                  </td>
                  <td className="max-w-[12rem] truncate px-3 py-1.5 hidden sm:table-cell">
                    {row.category || "—"}
                  </td>
                  <td className="max-w-[12rem] truncate px-3 py-1.5 hidden sm:table-cell">
                    {row.fromAccount || "—"}
                  </td>
                  <td className="px-3 py-1.5">
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {truncated && (
          <p className="mt-2 text-xs text-muted-foreground">
            Showing the first {MAX_PREVIEW_ROWS} of {importPreview.rows.length}{" "}
            rows.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-4 text-xs text-destructive">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            Import runs duplicate detection — matching transactions are skipped.
          </p>
          <Button onClick={handleImport} disabled={busy || inserted === 0}>
            <UploadCloud />
            {busy
              ? "Importing…"
              : `Import ${inserted} transaction${inserted === 1 ? "" : "s"}`}
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
          <Button onClick={() => onNavigate?.("transactions")}>
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
        Import a CSV or PDF statement
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose a bank statement export (CSV/TSV or a text-based PDF). We&apos;ll detect the columns
        first, then you confirm the mapping before anything is imported — nothing is guessed
        silently. Scanned/image-only PDFs aren&apos;t supported.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt,.pdf,text/csv,text/plain,application/pdf"
        className="hidden"
        aria-label="Choose a CSV or PDF file"
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

function StatusBadge({ status }: { status: "insert" | "duplicate" | "skipped" }) {
  const styles: Record<"insert" | "duplicate" | "skipped", string> = {
    insert: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    duplicate: "bg-muted text-muted-foreground",
    skipped: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  };
  const labels: Record<"insert" | "duplicate" | "skipped", string> = {
    insert: "New",
    duplicate: "Duplicate",
    skipped: "Skipped",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        styles[status]
      )}
    >
      {labels[status]}
    </span>
  );
}
