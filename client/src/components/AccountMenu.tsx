import { useEffect, useRef, useState } from "react";
import { Camera, LogOut, Moon, Sun, Trash2, User } from "lucide-react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useTheme } from "@/contexts/ThemeContext";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { Country } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const AVATAR_MAX_SIZE = 256;

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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function Avatar({
  name,
  image,
  className,
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  if (image) {
    return (
      <img
        src={image}
        alt=""
        className={cn(
          "shrink-0 rounded-full object-cover select-none",
          className
        )}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground select-none",
        className
      )}
    >
      {initials(name)}
    </span>
  );
}

function message(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

async function fileToAvatarDataUrl(file: File): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the image."));
    img.src = raw;
  });

  const scale = Math.min(1, AVATAR_MAX_SIZE / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is not supported.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const type = file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg";
  return canvas.toDataURL(type, 0.85);
}

export default function AccountMenu() {
  const { user, updateProfile, logout } = useAuth();
  const { saveSetting } = useSettings();
  const { theme, toggleTheme } = useTheme();
  const [profileOpen, setProfileOpen] = useState(false);
  const [name, setName] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [countries, setCountries] = useState<Country[] | null>(null);
  const [countriesError, setCountriesError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("The image must be smaller than 5 MB.");
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
          <DropdownMenuItem onClick={toggleTheme}>
            {theme === "dark" ? <Sun /> : <Moon />}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </DropdownMenuItem>
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
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving}
              aria-label="Change profile picture"
              title="Change profile picture"
              className="group relative overflow-hidden rounded-full focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
            >
              <Avatar name={name.trim() || "Account"} image={image} className="size-20 text-2xl" />
              <span className="absolute inset-0 flex items-center justify-center gap-1 bg-black/40 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="size-3.5" aria-hidden="true" />
                Change
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="Choose a profile picture"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.target.value = "";
              }}
            />
            {image && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setImage(null)}
                disabled={saving}
              >
                <Trash2 />
                Remove picture
              </Button>
            )}

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
