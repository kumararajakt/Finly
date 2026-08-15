import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import Avatar from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { api } from "@/lib/api";
import { fileToAvatarDataUrl, MAX_UPLOAD_BYTES } from "@/lib/avatar";
import { countryCodeFromTimeZone } from "@/lib/country";
import type { Country } from "@/lib/types";

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

export default function OnboardingDialog() {
  const { user, updateProfile } = useAuth();
  const { saveSetting } = useSettings();
  const [name, setName] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [countries, setCountries] = useState<Country[] | null>(null);
  const [countriesError, setCountriesError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(user?.name ?? "");
    setImage(user?.image ?? null);
    setCountry(user?.country ?? null);
    setError(null);
    if (countries === null && !countriesError) {
      loadCountries()
        .then((list) => {
          setCountries(list);
          setCountry((current) => current ?? countryCodeFromTimeZone(list) ?? null);
        })
        .catch(() => setCountriesError(true));
    }
  }, [user, countries, countriesError]);

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

  async function handleFinish() {
    const trimmed = name.trim();
    if (!trimmed) return setError("Name cannot be empty.");
    if (country === null && countries !== null) {
      return setError("Please choose your country.");
    }
    setSaving(true);
    setError(null);
    try {
      await updateProfile({ name: trimmed, image, country, onboardingComplete: true });
      if (country) {
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
    } catch (err) {
      setError(message(err));
      setSaving(false);
    }
  }

  const sortedCountries =
    countries === null
      ? []
      : [...countries].sort((a, b) => a.name.localeCompare(b.name));
  const canFinish =
    !saving &&
    name.trim().length > 0 &&
    (countries === null || country !== null);

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to Finly</DialogTitle>
          <DialogDescription>
            Set up your profile — pick a picture, your name, and country to
            personalize your experience.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
            aria-label="Choose a profile picture"
            title="Choose a profile picture"
            className="group relative overflow-hidden rounded-full focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
          >
            <Avatar name={name.trim() || "Account"} image={image} className="size-20 text-2xl" />
            <span className="absolute inset-0 flex items-center justify-center gap-1 bg-black/40 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="size-3.5" aria-hidden="true" />
              Upload
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
            <label htmlFor="onboarding-name" className="text-xs font-medium">
              Name
            </label>
            <Input
              id="onboarding-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              maxLength={80}
              autoFocus
            />
          </div>

          <div className="flex w-full flex-col gap-1.5">
            <label htmlFor="onboarding-country" className="text-xs font-medium">
              Country
            </label>
            <select
              id="onboarding-country"
              value={country ?? ""}
              onChange={(event) => setCountry(event.target.value || null)}
              disabled={saving || countries === null}
              aria-label="Country"
              className="h-9 w-full appearance-none rounded-lg border border-input bg-background px-3 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            >
              <option value="">Select your country</option>
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

          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleFinish} disabled={!canFinish}>
            {saving ? <Loader2 className="animate-spin" /> : null}
            Get started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
