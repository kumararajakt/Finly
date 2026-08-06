import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Period, Settings } from "@/lib/types";

const DEFAULT_SETTINGS: Settings = {
  selectedPeriod: "all-time",
  netWorthConfigured: false,
  totalAssets: 0,
  totalLiabilities: 0,
  currency: "USD",
  dismissedPatterns: [],
  googleDriveFolderName: null,
  googleDriveFolderId: null,
  googleDriveSchedule: null,
  googleDriveLastSync: null,
  googleDriveLastResult: null,
};

type SettingsStatus = "loading" | "success" | "error";

interface SettingsContextValue {
  settings: Settings;
  status: SettingsStatus;
  error: ApiError | undefined;
  setPeriod: (period: Period) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => void;
  refetch: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<SettingsStatus>("loading");
  const [error, setError] = useState<ApiError | undefined>(undefined);
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(undefined);
    api.settings
      .get()
      .then((data) => {
        if (cancelled) return;
        setSettings({ ...DEFAULT_SETTINGS, ...data });
        setStatus("success");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err : new ApiError("Failed to load settings.", 0));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  const setPeriod = useCallback(async (period: Period) => {
    setSettings((previous) => ({ ...previous, selectedPeriod: period }));
    try {
      await api.settings.set("selectedPeriod", period);
    } catch (err) {
      const previous = settings.selectedPeriod;
      setSettings((current) =>
        current.selectedPeriod === period ? { ...current, selectedPeriod: previous } : current
      );
      throw err instanceof ApiError ? err : new ApiError("Failed to save period.", 0);
    }
  }, [settings.selectedPeriod]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((previous) => ({ ...previous, ...patch }));
  }, []);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, status, error, setPeriod, updateSettings, refetch }),
    [settings, status, error, setPeriod, updateSettings, refetch]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider.");
  }
  return context;
}
