import { useEffect, useRef, useState } from "react";
import { LogOut, Moon, Sun, User, Monitor } from "lucide-react";
import Avatar from "@/components/Avatar";
import { AvatarPicker } from "@/components/AvatarPicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useTheme } from "@/contexts/ThemeContext";
import { api } from "@/lib/api";
import { fileToAvatarDataUrl, validateFile } from "@/lib/avatar";
import type { AvatarValue } from "@/lib/avatar";
import { formatCurrency } from "@/lib/format";
import type { Country } from "@/lib/types";
import { cn } from "@/lib/utils";

let countriesPromise: Promise<Country[]> | null = null;

function loadCountries(): Promise<Country[]> {
  if (!countriesPromise) {
    countriesPromise = api.countries.list().catch((error) => {
      countriesPromise = null;
      throw error;
    });
  }
  return countriesPromise;
}

function message(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

export default function AccountMenu() {
  const { user, updateProfile, logout } = useAuth();
  const { saveSetting } = useSettings();
  const { mode, setMode } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const [name, setName] = useState("");
  const [image, setImage] = useState<AvatarValue>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [countries, setCountries] = useState<Country[] | null>(null);
  const [countriesError, setCountriesError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousCountryRef = useRef<string | null>(null);

  useEffect(() => {
    if (!profileOpen) return;
    setName(user?.name ?? "");
    setImage(user?.image ?? null);
    setCountry(user?.country ?? null);
    previousCountryRef.current = user?.country ?? null;
    setError(null);
    if (countries === null && !countriesError) {
      loadCountries()
        .then(setCountries)
        .catch(() => setCountriesError(true));
    }
  }, [profileOpen, user, countries, countriesError]);

  async function handleFile(file: File) {
    const fileError = validateFile(file);
    if (fileError) {
      setError(fileError);
      return;
    }
    setError(null);
    try {
      setImage(await fileToAvatarDataUrl(file));
    } catch (err) {
      setError(message(err));
    }
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return setError("Name cannot be empty.");
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ name: trimmed, image, country });
      if (country && country !== previousCountryRef.current) {
        const entry = countries?.find((item) => item.code === country);
        if (entry) {
          try {
            await saveSetting("currency", entry.currency);
          } catch {
            // Non-fatal: the profile saved; currency stays as-is.
          }
        }
      }
      setSaving(false);
      setProfileOpen(false);
    } catch (err) {
      setError(message(err));
      setSaving(false);
    }
  }

  const displayName = user?.name?.trim() || user?.email || "Account";
  const sortedCountries =
    countries === null
      ? []
      : [...countries].sort((a, b) => a.name.localeCompare(b.name));
  const selected = countries?.find((item) => item.code === country) ?? null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              className="size-8 rounded-full p-0"
              aria-label="Account menu"
              title="Account menu"
            />
          }
        >
          <Avatar name={displayName} image={user?.image} className="size-7 text-xs" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setProfileOpen(true)}>
            <User />
            View profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Theme
          </div>
          <DropdownMenuItem
            onClick={() => setMode("light")}
            className={cn(mode === "light" && "bg-accent")}
          >
            <Sun className="size-4" />
            Light
            {mode === "light" && <span className="ml-auto text-xs">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setMode("dark")}
            className={cn(mode === "dark" && "bg-accent")}
          >
            <Moon className="size-4" />
            Dark
            {mode === "dark" && <span className="ml-auto text-xs">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setMode("system")}
            className={cn(mode === "system" && "bg-accent")}
          >
            <Monitor className="size-4" />
            System
            {mode === "system" && <span className="ml-auto text-xs">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => void logout()}>
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Profile</DialogTitle>
            <DialogDescription>
              Update your name, picture, and country.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3">
            <AvatarPicker
              value={image}
              onChange={setImage}
              onFile={handleFile}
              name={name.trim() || "Account"}
              disabled={saving}
            />

            <div className="flex w-full flex-col gap-1.5">
              <label htmlFor="profile-name" className="text-xs font-medium">
                Name
              </label>
              <Input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                maxLength={80}
              />
            </div>

            <div className="flex w-full flex-col gap-1.5">
              <label htmlFor="profile-country" className="text-xs font-medium">
                Country
              </label>
              <select
                id="profile-country"
                value={country ?? ""}
                onChange={(event) => setCountry(event.target.value || null)}
                disabled={saving || countries === null}
                aria-label="Country"
                className="h-9 w-full appearance-none rounded-lg border border-input bg-background px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              >
                <option value="">Not set</option>
                {sortedCountries.map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {entry.name}
                  </option>
                ))}
              </select>
              {countriesError && (
                <p className="text-xs text-destructive">
                  Could not load countries. Try again later.
                </p>
              )}
            </div>

            {selected && (
              <dl className="flex w-full flex-col gap-1.5 rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Time zone</dt>
                  <dd className="font-medium">{selected.timeZone.replace(/_/g, " ")}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Currency</dt>
                  <dd className="font-medium">
                    {formatCurrency(1234.56, selected.currency)} ({selected.currency})
                  </dd>
                </div>
              </dl>
            )}

            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setProfileOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
