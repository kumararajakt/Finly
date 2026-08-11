import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api } from "@/lib/api";
import type { Tag, Transaction } from "@/lib/types";
import TagPicker from "./TagPicker";
import { ensureTags, message } from "./shared";

interface TagEditorSheetProps {
  transaction: Transaction;
  tags: Tag[];
  onClose: () => void;
  onSaved: (updated: Transaction) => void;
}

export default function TagEditorSheet({ transaction, tags, onClose, onSaved }: TagEditorSheetProps) {
  const [selected, setSelected] = useState<string[]>(transaction.tags);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelected(transaction.tags);
  }, [transaction]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await ensureTags(selected);
      const updated = await api.transactions.update(transaction.id, { tags: selected });
      setSaving(false);
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(message(err));
      setSaving(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit tags</SheetTitle>
          <SheetDescription>{transaction.merchant}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">
          <TagPicker
            available={tags.map((tag) => tag.name)}
            selected={selected}
            onChange={setSelected}
          />
          {error && (
            <p role="alert" className="mt-3 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
        <SheetFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save tags"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
