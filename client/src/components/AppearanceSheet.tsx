import { useState } from "react";
import { Check, ChevronDown, Code2, Paintbrush, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useTheme } from "@/contexts/ThemeContext";
import {
  CUSTOM_PALETTE_ID,
  THEME_PALETTES,
  previewFromVars,
  type ThemePalettePreview,
} from "@/lib/theme-palettes";
import { cn } from "@/lib/utils";

function PalettePreview({ preview }: { preview: ThemePalettePreview }) {
  return (
    <div
      className="relative h-16 w-full overflow-hidden rounded-lg"
      style={{ background: preview.background }}
    >
      <div
        className="absolute left-2 top-2 h-6 w-6 rounded-md shadow-sm"
        style={{ background: preview.sidebar }}
      />
      <div
        className="absolute left-10 top-2 h-2 w-12 rounded-full"
        style={{ background: preview.primary, opacity: 0.9 }}
      />
      <div
        className="absolute left-10 top-6 h-1.5 w-8 rounded-full"
        style={{ background: preview.chart1, opacity: 0.6 }}
      />
      <div className="absolute bottom-2 left-2 right-2 flex gap-1">
        {[preview.primary, preview.chart1, preview.chart2].map((color, index) => (
          <div
            key={index}
            className="h-2 flex-1 rounded-full"
            style={{ background: color, opacity: 0.75 }}
          />
        ))}
      </div>
    </div>
  );
}

export default function AppearanceSheet() {
  const {
    paletteId,
    setPaletteId,
    customTheme,
    importCustomTheme,
    clearCustomTheme,
  } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [cssDraft, setCssDraft] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const needle = query.trim().toLowerCase();
  const presets = THEME_PALETTES.filter(
    (palette) =>
      !needle ||
      palette.name.toLowerCase().includes(needle) ||
      palette.description.toLowerCase().includes(needle)
  );
  const cards = customTheme
    ? [
        {
          id: CUSTOM_PALETTE_ID,
          name: "Custom",
          description: "Imported",
          preview: previewFromVars(customTheme.light),
        },
        ...presets,
      ]
    : presets;

  const handleImport = () => {
    if (importCustomTheme(cssDraft)) {
      setImportError(null);
      setImportOpen(false);
      setCssDraft("");
    } else {
      setImportError(
        "Couldn't read theme CSS — paste the :root and .dark blocks from ui.shadcn.com/themes."
      );
    }
  };

  const handleRemove = () => {
    clearCustomTheme();
    setImportError(null);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label="Appearance"
        title="Appearance"
      >
        <Paintbrush />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Appearance</SheetTitle>
            <SheetDescription>
              Choose a color theme for the interface. Works with both light and
              dark modes.
            </SheetDescription>
          </SheetHeader>

          <div className="px-4">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search themes…"
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4">
            {cards.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No themes found
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {cards.map((card) => {
                  const selected = card.id === paletteId;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => setPaletteId(card.id)}
                      aria-pressed={selected}
                      className={cn(
                        "relative flex flex-col gap-2 rounded-xl border-2 p-3 text-left transition-all hover:border-primary/50",
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-accent/30"
                      )}
                    >
                      <PalettePreview preview={card.preview} />
                      <div>
                        <p className="text-xs font-semibold leading-none">
                          {card.name}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[10px] leading-tight text-muted-foreground">
                          {card.description}
                        </p>
                      </div>
                      {selected && (
                        <span className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                          <Check className="size-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="rounded-xl border border-dashed border-border p-3">
              <button
                type="button"
                onClick={() => setImportOpen((value) => !value)}
                className="flex w-full items-center gap-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <Code2 className="size-3.5" aria-hidden="true" />
                Import a Custom theme
                <ChevronDown
                  className={cn(
                    "ml-auto size-3.5 transition-transform",
                    importOpen && "rotate-180"
                  )}
                  aria-hidden="true"
                />
              </button>

              {importOpen && (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={cssDraft}
                    onChange={(event) => setCssDraft(event.target.value)}
                    rows={5}
                    placeholder={":root {\n  --background: …;\n  …\n}\n\n.dark {\n  …\n}"}
                    className="w-full resize-y rounded-md border border-border bg-background p-2 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                  />
                  {importError && (
                    <p className="text-xs text-destructive">{importError}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="h-7 px-3 text-xs"
                      onClick={handleImport}
                    >
                      Apply theme
                    </Button>
                    {customTheme && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-3 text-xs"
                        onClick={handleRemove}
                      >
                        Remove custom
                      </Button>
                    )}
                  </div>
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    Pick a theme at ui.shadcn.com/themes, copy its CSS, and
                    paste it here. Colorful chart colors apply to the charts;
                    neutral ones fall back to the default set.
                  </p>
                </div>
              )}
            </div>
          </div>

          <SheetFooter>
            <p className="text-xs text-muted-foreground">
              Theme preference is saved locally in your browser.
            </p>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
