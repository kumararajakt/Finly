import { useRef, useState } from "react";
import { Upload, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { ApiError, api } from "@/lib/api";
import type { TradeColumnMapping, TradeImportPreview } from "@/lib/types";

function message(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

interface TradeImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

type Step = "upload" | "mapping" | "review" | "result";

export function TradeImportModal({
  open,
  onOpenChange,
  onImported,
}: TradeImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<TradeImportPreview | null>(null);
  const [mapping, setMapping] = useState<TradeColumnMapping | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    inserted: number;
    skipped: number;
    totalRows: number;
  } | null>(null);

  async function handleFileSelect(file: File) {
    setError(null);
    const text = await file.text();
    setCsv(text);

    try {
      setLoading(true);
      const result = await api.investments.importTradesPreview(text);
      setPreview(result);
      setMapping(result.mapping);
      setStep("mapping");
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!csv || !mapping) return;

    try {
      setLoading(true);
      setError(null);
      const res = await api.investments.importTrades(csv, mapping);
      setResult(res);
      setStep("result");
      onImported();
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setStep("upload");
    setCsv("");
    setPreview(null);
    setMapping(null);
    setError(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleClose() {
    handleReset();
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Import Investment Trades</SheetTitle>
          <SheetDescription>
            {step === "upload" && "Upload a CSV file with your trades"}
            {step === "mapping" && "Review and adjust column mapping"}
            {step === "review" && "Review trades before importing"}
            {step === "result" && "Import complete"}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {step === "upload" && (
            <div className="space-y-4">
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                <Upload className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                <p className="mb-2 text-sm font-medium">Drop your CSV file here</p>
                <p className="mb-4 text-xs text-gray-500">
                  Required columns: date, security, side, units, price
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Select File
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 flex gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>
          )}

          {step === "mapping" && preview && mapping && (
            <div className="space-y-4">
              {preview.ambiguous.length > 0 && (
                <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-700">
                  <p className="font-medium mb-1">Ambiguous columns:</p>
                  <p>{preview.ambiguous.join(", ")}</p>
                  <p className="text-xs mt-2">
                    Adjust column indices below if needed
                  </p>
                </div>
              )}

              <div className="space-y-3 text-sm">
                <div>
                  <label className="block font-medium mb-1">Date column</label>
                  <Input
                    type="number"
                    value={mapping.date}
                    onChange={(e) =>
                      setMapping({
                        ...mapping,
                        date: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Security column
                  </label>
                  <Input
                    type="number"
                    value={mapping.security}
                    onChange={(e) =>
                      setMapping({
                        ...mapping,
                        security: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">
                    Side column (buy/sell/dividend/interest)
                  </label>
                  <Input
                    type="number"
                    value={mapping.side}
                    onChange={(e) =>
                      setMapping({
                        ...mapping,
                        side: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Units column</label>
                  <Input
                    type="number"
                    value={mapping.units}
                    onChange={(e) =>
                      setMapping({
                        ...mapping,
                        units: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Price column</label>
                  <Input
                    type="number"
                    value={mapping.price}
                    onChange={(e) =>
                      setMapping({
                        ...mapping,
                        price: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="text-sm text-gray-600">
                <p className="font-medium mb-2">Sample rows:</p>
                <div className="rounded border overflow-x-auto">
                  <Table>
                    <TableHead>
                      <TableRow>
                        {preview.headers.map((h, i) => (
                          <TableCell key={i} className="text-xs">
                            {h || `Col ${i}`}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {preview.sampleRows.slice(0, 3).map((row, i) => (
                        <TableRow key={i}>
                          {row.map((cell, j) => (
                            <TableCell key={j} className="text-xs py-1">
                              {cell}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 flex gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>
          )}

          {step === "result" && result && (
            <div className="space-y-4 text-center py-8">
              <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
              <div>
                <p className="text-lg font-semibold">Import complete</p>
                <p className="text-sm text-gray-600 mt-1">
                  {result.inserted} trades imported, {result.skipped} skipped
                </p>
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="gap-2 pt-4 border-t">
          {step === "upload" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </>
          )}

          {step === "mapping" && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("upload")}
                disabled={loading}
              >
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={loading || !mapping}
              >
                {loading ? "Importing..." : "Import"}
              </Button>
            </>
          )}

          {step === "result" && (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
