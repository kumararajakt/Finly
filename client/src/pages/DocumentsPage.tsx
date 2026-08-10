import CsvImportCard from "@/components/CsvImportCard";

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
