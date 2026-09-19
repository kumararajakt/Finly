import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CUSTOM_PALETTE_ID,
  DEFAULT_PALETTE_ID,
  THEME_VAR_KEYS,
  getPalette,
  getParsedTheme,
  parseThemeCss,
  type ParsedThemeCss,
} from "@/lib/theme-palettes";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "finly-theme-mode";
const PALETTE_STORAGE_KEY = "finly-theme-palette";
const CUSTOM_THEME_STORAGE_KEY = "finly-theme-custom-css";

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  paletteId: string;
  setPaletteId: (id: string) => void;
  /** Parsed tokens of a user-imported theme (from ui.shadcn.com CSS), if any. */
  customTheme: ParsedThemeCss | null;
  /** Parse + apply + persist an imported theme CSS block. Returns false on failure. */
  importCustomTheme: (css: string) => boolean;
  /** Remove the imported theme (falls back to the default palette). */
  clearCustomTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored as ThemeMode;
    }
  } catch {
    // localStorage unavailable (private mode, etc.) — fall through to system.
  }
  return "system";
}

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") {
    return getSystemTheme();
  }
  return mode;
}

function getInitialPaletteId(): string {
  try {
    const stored = localStorage.getItem(PALETTE_STORAGE_KEY);
    if (stored === CUSTOM_PALETTE_ID || getPalette(stored).id === stored) {
      return stored as string;
    }
  } catch {
    // localStorage unavailable — fall through to default.
  }
  return DEFAULT_PALETTE_ID;
}

function getInitialCustomTheme(): ParsedThemeCss | null {
  try {
    const stored = localStorage.getItem(CUSTOM_THEME_STORAGE_KEY);
    return stored ? parseThemeCss(stored) : null;
  } catch {
    // localStorage unavailable — no imported theme this session.
    return null;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(
    getSystemTheme()
  );
  const [paletteId, setPaletteIdState] = useState<string>(getInitialPaletteId);
  const [customTheme, setCustomThemeState] = useState<ParsedThemeCss | null>(
    getInitialCustomTheme
  );

  const resolved = resolveTheme(mode);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      const newTheme = mediaQuery.matches ? "dark" : "light";
      setSystemTheme(newTheme);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const theme = mode === "system" ? systemTheme : mode;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
  }, [mode, systemTheme]);

  useEffect(() => {
    const root = document.documentElement;
    const theme = mode === "system" ? systemTheme : mode;
    // Clear every previously applied override (built-in palette or custom),
    // then apply the active theme's tokens. Light-mode tokens are applied
    // first and dark-mode tokens on top (mirroring the `:root` → `.dark`
    // cascade in the theme CSS).
    for (const key of THEME_VAR_KEYS) {
      root.style.removeProperty(key);
    }
    const parsed =
      paletteId === CUSTOM_PALETTE_ID ? customTheme : getParsedTheme(paletteId);
    if (parsed) {
      for (const [key, value] of Object.entries(parsed.light)) {
        root.style.setProperty(key, value);
      }
      if (theme === "dark") {
        for (const [key, value] of Object.entries(parsed.dark)) {
          root.style.setProperty(key, value);
        }
      }
      // The theme's typeface: fonts can't rely on Tailwind's `@theme`
      // variable indirection at runtime, so set them directly.
      const font = parsed.light["--font-sans"];
      if (font) {
        root.style.setProperty("--font-heading", font);
        root.style.setProperty("--default-font-family", font);
        root.style.fontFamily = font;
      } else {
        root.style.fontFamily = "";
      }
    } else {
      root.style.fontFamily = "";
    }
  }, [mode, systemTheme, paletteId, customTheme]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch {
      // Persisting is best-effort; the class still applies for this session.
    }
  }, []);

  const setPaletteId = useCallback((id: string) => {
    setPaletteIdState(id);
    try {
      localStorage.setItem(PALETTE_STORAGE_KEY, id);
    } catch {
      // Persisting is best-effort; the palette still applies for this session.
    }
  }, []);

  const importCustomTheme = useCallback((css: string) => {
    const parsed = parseThemeCss(css);
    if (!parsed) {
      return false;
    }
    setCustomThemeState(parsed);
    setPaletteIdState(CUSTOM_PALETTE_ID);
    try {
      localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, css);
      localStorage.setItem(PALETTE_STORAGE_KEY, CUSTOM_PALETTE_ID);
    } catch {
      // Persisting is best-effort; the theme still applies for this session.
    }
    return true;
  }, []);

  const clearCustomTheme = useCallback(() => {
    setCustomThemeState(null);
    setPaletteIdState(DEFAULT_PALETTE_ID);
    try {
      localStorage.removeItem(CUSTOM_THEME_STORAGE_KEY);
      localStorage.setItem(PALETTE_STORAGE_KEY, DEFAULT_PALETTE_ID);
    } catch {
      // Persisting is best-effort.
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolved,
      setMode,
      paletteId,
      setPaletteId,
      customTheme,
      importCustomTheme,
      clearCustomTheme,
    }),
    [
      mode,
      resolved,
      setMode,
      paletteId,
      setPaletteId,
      customTheme,
      importCustomTheme,
      clearCustomTheme,
    ]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider.");
  }
  return context;
}