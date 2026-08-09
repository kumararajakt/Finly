import { useState } from "react";
import { Pencil, Plus, SlidersHorizontal, Tag as TagIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import ErrorState from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import LoadingState from "@/components/ui/loading-state";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useQuery } from "@/hooks/use-query";
import { ApiError, api } from "@/lib/api";
import type { Rule, Tag } from "@/lib/types";
import { cn } from "@/lib/utils";

function message(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

interface RuleFormState {
  whenText: string;
  thenText: string;
  enabled: boolean;
}

function initialForm(initial: Rule | null): RuleFormState {
  return {
    whenText: initial?.whenText ?? "",
    thenText: initial?.thenText ?? "",
    enabled: initial?.enabled ?? true,
  };
}

interface RuleFormProps {
  initial: Rule | null;
  onSaved: () => void;
  onDeleted: () => void;
}

function RuleForm({ initial, onSaved, onDeleted }: RuleFormProps) {
  const [form, setForm] = useState<RuleFormState>(() => initialForm(initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.whenText.trim()) return setError("Please enter a when condition.");
    if (!form.thenText.trim()) return setError("Please enter a then action.");

    const payload = {
      whenText: form.whenText.trim(),
      thenText: form.thenText.trim(),
      enabled: form.enabled,
    };

    setSaving(true);
    setError(null);
    try {
      if (initial) {
        await api.rules.update(initial.id, payload);
      } else {
        await api.rules.create(payload);
      }
      setSaving(false);
      onSaved();
    } catch (err) {
      setError(message(err));
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initial) return;
    if (!window.confirm(`Delete this rule?`)) return;
    setDeleting(true);
    setError(null);
    try {
      await api.rules.remove(initial.id);
      setDeleting(false);
      onDeleted();
    } catch (err) {
      setError(message(err));
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <SheetHeader>
        <SheetTitle>{initial ? "Edit rule" : "Create rule"}</SheetTitle>
        <SheetDescription>
          Applied to future imports after duplicate detection; existing transactions are not rewritten.
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">When</label>
          <Input
            value={form.whenText}
            onChange={(e) => setForm((f) => ({ ...f, whenText: e.target.value }))}
            placeholder="e.g. merchant contains Whole Foods"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium">Then</label>
          <Input
            value={form.thenText}
            onChange={(e) => setForm((f) => ({ ...f, thenText: e.target.value }))}
            placeholder="e.g. categorize as Groceries"
            required
          />
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
            className="size-4"
          />
          <span className="text-sm">Enabled</span>
        </label>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
      <SheetFooter className="flex-row justify-between">
        {initial ? (
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 />
            {deleting ? "Deleting…" : "Delete rule"}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : initial ? "Save changes" : "Create rule"}
        </Button>
      </SheetFooter>
    </form>
  );
}

export default function RulesPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [addingTag, setAddingTag] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const rules = useQuery<Rule[]>(() => api.rules.list(), []);
  const tags = useQuery<Tag[]>(() => api.tags.list(), []);

  function openCreate() {
    setEditing(null);
    setMutationError(null);
    setAddOpen(true);
  }

  function openEdit(item: Rule) {
    setEditing(item);
    setMutationError(null);
    setAddOpen(true);
  }

  async function handleToggleRule(item: Rule) {
    setSavingId(item.id);
    setMutationError(null);
    try {
      const updated = await api.rules.update(item.id, { enabled: !item.enabled });
      rules.setData((list) => (list ?? []).map((r) => (r.id === updated.id ? updated : r)));
    } catch (error) {
      setMutationError(message(error));
    } finally {
      setSavingId(null);
    }
  }

  async function handleAddTag() {
    const name = tagDraft.trim();
    if (!name) return;
    setAddingTag(true);
    setMutationError(null);
    try {
      await api.tags.create(name);
      setTagDraft("");
      tags.refetch();
    } catch (error) {
      setMutationError(message(error));
    } finally {
      setAddingTag(false);
    }
  }

  async function handleDeleteTag(tag: Tag) {
    if (
      !window.confirm(
        `Delete tag "${tag.name}"? It will be removed from future selectors. Existing transactions keep the label.`
      )
    ) {
      return;
    }
    setSavingId(tag.name);
    setMutationError(null);
    try {
      await api.tags.remove(tag.name);
      tags.refetch();
    } catch (error) {
      setMutationError(message(error));
    } finally {
      setSavingId(null);
    }
  }

  function handleRuleSaved() {
    rules.refetch();
    setAddOpen(false);
    setEditing(null);
  }

  function handleRuleDeleted() {
    rules.refetch();
    setAddOpen(false);
    setEditing(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Rules and tags</h2>
          <p className="text-sm text-muted-foreground">
            Categorize future imports and manage your tags.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          Create rule
        </Button>
      </div>

      {mutationError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <span>{mutationError}</span>
          <button
            type="button"
            onClick={() => setMutationError(null)}
            aria-label="Dismiss"
            className="rounded p-0.5 hover:bg-destructive/20"
          >
            <span className="block size-4">×</span>
          </button>
        </div>
      )}

      <section className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-sm font-medium">Categorization rules</h3>
          {rules.status === "success" && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {(rules.data ?? []).length}
            </span>
          )}
        </div>

        {rules.status === "loading" && <LoadingState label="Loading rules…" />}
        {rules.status === "error" && (
          <ErrorState
            message={rules.error?.message ?? "Failed to load rules."}
            onRetry={rules.refetch}
          />
        )}
        {rules.status === "success" &&
          ((rules.data ?? []).length === 0 ? (
            <EmptyState
              icon={SlidersHorizontal}
              title="No rules yet"
              description="Create a rule to automatically categorize matching transactions on future imports."
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus />
                  Create rule
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {(rules.data ?? []).map((rule) => (
                <div
                  key={rule.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <p className={cn("min-w-0 text-sm", !rule.enabled && "text-muted-foreground")}>
                    <span className="text-muted-foreground">When</span>{" "}
                    <span className="font-medium">{rule.whenText}</span>{" "}
                    <span className="text-muted-foreground">then</span>{" "}
                    <span className="font-medium">{rule.thenText}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        disabled={savingId === rule.id}
                        onChange={() => handleToggleRule(rule)}
                        aria-label={`Toggle rule ${rule.whenText}`}
                        className="size-4"
                      />
                      Enabled
                    </label>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => openEdit(rule)}
                      aria-label={`Edit rule ${rule.whenText}`}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(rule);
                        setAddOpen(true);
                      }}
                      aria-label={`Delete rule ${rule.whenText}`}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ))}
      </section>

      <section className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TagIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            <h3 className="text-sm font-medium">Tags</h3>
            {tags.status === "success" && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {(tags.data ?? []).length}
              </span>
            )}
          </div>
          <div className="flex gap-1.5">
            <Input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              placeholder="New tag name"
              className="w-40 sm:w-48"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleAddTag}
              disabled={!tagDraft.trim() || addingTag}
            >
              {addingTag ? "Adding…" : "Add tag"}
            </Button>
          </div>
        </div>

        {tags.status === "loading" && <LoadingState label="Loading tags…" />}
        {tags.status === "error" && (
          <ErrorState
            message={tags.error?.message ?? "Failed to load tags."}
            onRetry={tags.refetch}
          />
        )}
        {tags.status === "success" &&
          ((tags.data ?? []).length === 0 ? (
            <EmptyState
              icon={TagIcon}
              title="No tags yet"
              description="Add a tag by name to attach it to transactions."
            />
          ) : (
            <div className="divide-y divide-border">
              {(tags.data ?? []).map((tag) => (
                <div
                  key={tag.name}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border bg-muted/50 px-2 py-0.5 text-xs font-medium">
                      {tag.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {tag.count} transaction{tag.count === 1 ? "" : "s"}
                    </span>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => handleDeleteTag(tag)}
                      disabled={savingId === tag.name}
                      aria-label={`Delete tag ${tag.name}`}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ))}
      </section>

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <RuleForm
            key={editing?.id ?? "new"}
            initial={editing}
            onSaved={handleRuleSaved}
            onDeleted={handleRuleDeleted}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
