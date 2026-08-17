import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Period, Settings } from "@/lib/types";

const DEFAULT_SETTINGS: Settings = {
  selectedPeriod: "all-time",
  customDateFrom: null,
  customDateTo: null,
  netWorthAdjustment: 0,
  currency: "USD",
  density: "comfortable",
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
  saveSetting: (
    key: keyof Settings,
    value: string | number | boolean | string[] | null
  ) => Promise<Settings>;
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
    document.documentElement.dataset.density = settings.density;
  }, [settings.density]);

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

  const saveSetting = useCallback(
    async (key: keyof Settings, value: string | number | boolean | string[] | null) => {
      const data = await api.settings.set(key, value);
      setSettings({ ...DEFAULT_SETTINGS, ...data });
      return data;
    },
    []
  );

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, status, error, setPeriod, updateSettings, saveSetting, refetch }),
    [settings, status, error, setPeriod, updateSettings, saveSetting, refetch]
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
