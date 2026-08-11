import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TagPickerProps {
  available: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}

export default function TagPicker({ available, selected, onChange }: TagPickerProps) {
  const [draft, setDraft] = useState("");

  function addNew() {
    const name = draft.trim();
    if (!name) return;
    if (!selected.includes(name)) onChange([...selected, name]);
    setDraft("");
  }

  function toggle(name: string) {
    onChange(
      selected.includes(name) ? selected.filter((value) => value !== name) : [...selected, name]
    );
  }

  return (
    <div className="space-y-3">
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {selected.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-xs text-foreground transition-colors hover:border-input"
            >
              {tag}
              <X className="size-3" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      {available.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Existing tags</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {available
              .filter((tag) => !selected.includes(tag))
              .map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggle(tag)}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
                >
                  <Plus className="size-3" aria-hidden="true" />
                  {tag}
                </button>
              ))}
          </div>
        </div>
      )}
      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addNew();
            }
          }}
          placeholder="Add a new tag by name"
        />
        <Button type="button" variant="outline" onClick={addNew} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}
