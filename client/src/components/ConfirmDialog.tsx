import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { message } from "@/components/transactions/shared";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  cancelLabel?: string;
  /** `destructive` for anything that deletes; `default` for reversible resets. */
  tone?: "destructive" | "default";
  /**
   * Runs the action. Let it throw on failure — the dialog catches, shows the
   * message inline and stays open, so the user does not have to guess whether
   * a dismissed dialog meant success or failure.
   */
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
}

/**
 * Replacement for `window.confirm`. The caller holds only the pending target
 * (usually the item's id) and passes an async action; this owns the in-flight
 * and error state so each call site does not re-implement it.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  pendingLabel = "Deleting…",
  cancelLabel = "Cancel",
  tone = "destructive",
  onConfirm,
  onOpenChange,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear stale state so a reopened dialog never shows the last failure.
  useEffect(() => {
    if (!open) {
      setPending(false);
      setError(null);
    }
  }, [open]);

  async function handleConfirm() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      setError(message(err));
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === "destructive" ? "destructive" : "default"}
            onClick={() => void handleConfirm()}
            disabled={pending}
          >
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
