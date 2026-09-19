/**
 * Color "appearance" themes for Finly.
 *
 * Each predefined theme is a complete shadcn-style CSS file in `src/themes`
 * — `:root` + `.dark` token blocks covering colors, typography, radius and
 * shadows. The files are bundled as raw text (`?raw`), parsed at runtime into
 * light/dark token maps, and applied inline on `<html>` by `ThemeContext` —
 * the same mechanism used for CSS the user pastes from ui.shadcn.com/themes.
 */

import amberMinimalCss from "@/themes/amber-minimal.css?raw";
import claudeCss from "@/themes/claude.css?raw";
import cleanSlateCss from "@/themes/clean-slate.css?raw";
import cosmicNightCss from "@/themes/cosmic-night.css?raw";
import defaultCss from "@/themes/default.css?raw";
import modernMinimalCss from "@/themes/modern-minimal.css?raw";
import oceanBreezeCss from "@/themes/ocean-breeze.css?raw";
import retroArcadeCss from "@/themes/retro-arcade.css?raw";
import supabaseCss from "@/themes/supabase.css?raw";
import vercelCss from "@/themes/vercel.css?raw";

export interface ThemePalettePreview {
  background: string;
  sidebar: string;
  primary: string;
  chart1: string;
  chart2: string;
}

export interface ThemePalette {
  id: string;
  name: string;
  description: string;
  /** Raw CSS for the theme (light + dark token blocks). */
  css: string;
  /** Swatches shown in the picker card preview (derived from the CSS). */
  preview: ThemePalettePreview;
}

/**
 * Every CSS variable a theme may touch — used to clear stale inline values
 * and to whitelist tokens accepted from imported shadcn theme CSS.
 */
export const THEME_VAR_KEYS = [
  "--background",
  "--foreground",
  "--card",
  "--card-foreground",
  "--popover",
  "--popover-foreground",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--secondary-foreground",
  "--muted",
  "--muted-foreground",
  "--accent",
  "--accent-foreground",
  "--destructive",
  "--destructive-foreground",
  "--border",
  "--input",
  "--ring",
  "--radius",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
  "--sidebar",
  "--sidebar-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
  "--sidebar-border",
  "--sidebar-ring",
  "--warning",
  "--warning-foreground",
  // Typography (themes swap in their own typefaces).
  "--font-sans",
  "--font-serif",
  "--font-mono",
  "--font-heading",
  "--default-font-family",
  // Shadows & misc tokens exported by the theme files.
  "--shadow-x",
  "--shadow-y",
  "--shadow-blur",
  "--shadow-spread",
  "--shadow-opacity",
  "--shadow-color",
  "--shadow-2xs",
  "--shadow-xs",
  "--shadow-sm",
  "--shadow",
  "--shadow-md",
  "--shadow-lg",
  "--shadow-xl",
  "--shadow-2xl",
  "--tracking-normal",
  "--spacing",
] as const;

function parseOklch(color: string): { l: number; c: number; h: number } | null {
  const match = /^oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.%]+)?\)$/.exec(
    color
  );
  if (!match) return null;
  return { l: Number(match[1]), c: Number(match[2]), h: Number(match[3]) };
}

function parseHex(
  color: string
): { r: number; g: number; b: number } | null {
  const match = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(color.trim());
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((char) => char + char)
      .join("");
  }
  return {
    r: parseInt(hex.slice(0, 2), 16) / 255,
    g: parseInt(hex.slice(2, 4), 16) / 255,
    b: parseInt(hex.slice(4, 6), 16) / 255,
  };
}

function linearize(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow((channel + 0.055) / 1.055, 2.4);
}

/** Oklch chroma of a hex color (0 if unparseable). */
function hexChroma(rgb: { r: number; g: number; b: number }): number {
  const r = linearize(rgb.r);
  const g = linearize(rgb.g);
  const b = linearize(rgb.b);
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
  return Math.hypot(a, b_);
}

/** Approximate chroma for any supported color (oklch() or hex). */
function chromaOf(color: string): number {
  const parsed = parseOklch(color);
  if (parsed) return parsed.c;
  const rgb = parseHex(color);
  return rgb ? hexChroma(rgb) : 0;
}

/**
 * Default chart series — the `--chart-1..5` colors of the default theme in
 * `src/themes/default.css`, a cohesive blue ramp. Series map 1:1 onto the
 * tokens: charts[0] is the cash-flow income color (chart-1), charts[1] the
 * spending color (chart-2), and the donut cycles from charts[0]. Fallback
 * used when an imported theme's chart colors are too neutral.
 */
export const DEFAULT_CHARTS = [
  "oklch(0.81 0.1 252)", // #91c5ff light blue (donut lead)
  "oklch(0.62 0.19 260)", // #3a81f6 blue (income)
  "oklch(0.55 0.22 263)", // #2563ef vivid blue (spending)
  "oklch(0.49 0.22 264)", // #1a4eda deep blue
  "oklch(0.42 0.18 266)", // #1f3fad darkest blue
];

const CHART_TOKEN_NAMES = [
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
];

function averageChroma(colors: string[]): number {
  let total = 0;
  for (const color of colors) {
    total += chromaOf(color);
  }
  return colors.length ? total / colors.length : 0;
}

function chartTokensFor(
  theme: ParsedThemeCss,
  resolved: "light" | "dark"
): string[] {
  const source =
    resolved === "dark" && theme.dark["--chart-1"] ? theme.dark : theme.light;
  return CHART_TOKEN_NAMES.map((name) => source[name]).filter(
    (value): value is string => Boolean(value)
  );
}

/**
 * The chart colors to use for the active theme.
 *
 * - Imported (custom) themes contribute their `--chart-1..5` tokens when the
 *   series is actually colorful (average chroma ≥ 0.1). Neutral/gray series —
 *   the shadcn default — fall back to `DEFAULT_CHARTS` so categories stay
 *   distinct.
 * - Built-in palettes always use their theme file's chart tokens (they're
 *   authored, so no chroma gate).
 * - Otherwise `DEFAULT_CHARTS` is used.
 */
export function resolveChartColors(options: {
  paletteId: string;
  customTheme: ParsedThemeCss | null;
  resolved: "light" | "dark";
}): string[] {
  const { paletteId, customTheme, resolved } = options;
  if (paletteId === CUSTOM_PALETTE_ID && customTheme) {
    const colors = chartTokensFor(customTheme, resolved);
    if (colors.length >= 2 && averageChroma(colors) >= 0.1) {
      return colors;
    }
    return DEFAULT_CHARTS;
  }
  const parsed = getParsedTheme(paletteId);
  if (parsed) {
    const colors = chartTokensFor(parsed, resolved);
    if (colors.length >= 2) {
      return colors;
    }
  }
  return DEFAULT_CHARTS;
}

export const DEFAULT_PALETTE_ID = "default";

export const CUSTOM_PALETTE_ID = "custom";

export interface ParsedThemeCss {
  light: Record<string, string>;
  dark: Record<string, string>;
}

const TOKEN_NAMES = new Set<string>(THEME_VAR_KEYS);

function extractDeclarations(block: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const raw of block.split(";")) {
    const separator = raw.indexOf(":");
    if (separator < 0) continue;
    const name = raw.slice(0, separator).trim();
    if (!name.startsWith("--") || !TOKEN_NAMES.has(name)) continue;
    let value = raw.slice(separator + 1).trim();
    value = value.replace(/\s*!important\s*$/, "").trim();
    if (!value || /[{}]/.test(value)) continue;
    vars[name] = value;
  }
  return vars;
}

/**
 * Parse a shadcn theme's CSS (as exported by ui.shadcn.com/themes or bundled
 * in `src/themes`) into light- and dark-mode token maps. Only whitelisted
 * `--token` names are kept. Returns null when the CSS doesn't contain a
 * recognizable theme.
 */
export function parseThemeCss(css: string): ParsedThemeCss | null {
  const result: ParsedThemeCss = { light: {}, dark: {} };
  for (const match of css.matchAll(/:root\s*\{([\s\S]*?)\}/g)) {
    Object.assign(result.light, extractDeclarations(match[1]));
  }
  for (const match of css.matchAll(/\.dark\s*\{([\s\S]*?)\}/g)) {
    Object.assign(result.dark, extractDeclarations(match[1]));
  }
  if (!result.light["--background"] && !result.light["--primary"]) {
    return null;
  }
  return result;
}

/** Preview swatches for a parsed theme's light-mode tokens. */
export function previewFromVars(
  vars: Record<string, string>
): ThemePalettePreview {
  return {
    background: vars["--background"] ?? "#ffffff",
    sidebar: vars["--sidebar"] ?? vars["--muted"] ?? "#f4f4f5",
    primary: vars["--primary"] ?? "#18181b",
    chart1: vars["--chart-1"] ?? "#91c5ff",
    chart2: vars["--chart-2"] ?? "#3a81f6",
  };
}

const parsedCache = new Map<string, ParsedThemeCss>();

/**
 * Parse a built-in palette's CSS once and cache it. Custom palettes have no
 * bundled CSS — they return null (a parsed `ParsedThemeCss` is applied).
 */
export function getParsedTheme(paletteId: string): ParsedThemeCss | null {
  if (paletteId === CUSTOM_PALETTE_ID) return null;
  const cached = parsedCache.get(paletteId);
  if (cached) return cached;
  const parsed = parseThemeCss(getPalette(paletteId).css);
  if (parsed) {
    parsedCache.set(paletteId, parsed);
  }
  return parsed;
}

interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  css: string;
}

const THEME_DEFINITIONS: ThemeDefinition[] = [
  {
    id: "default",
    name: "Default",
    description: "Clean neutral look with the classic blue chart set",
    css: defaultCss,
  },
  {
    id: "ocean-breeze",
    name: "Ocean Breeze",
    description: "Aqua-green accent on a breezy sky background",
    css: oceanBreezeCss,
  },
  {
    id: "supabase",
    name: "Supabase",
    description: "Mint green with a playful multi-color chart set",
    css: supabaseCss,
  },
  {
    id: "claude",
    name: "Claude",
    description: "Warm terracotta and cream",
    css: claudeCss,
  },
  {
    id: "cosmic-night",
    name: "Cosmic Night",
    description: "Deep violet night sky",
    css: cosmicNightCss,
  },
  {
    id: "modern-minimal",
    name: "Modern Minimal",
    description: "Clean blue with compact corners",
    css: modernMinimalCss,
  },
  {
    id: "amber-minimal",
    name: "Amber Minimal",
    description: "Warm amber minimalism",
    css: amberMinimalCss,
  },
  {
    id: "retro-arcade",
    name: "Retro Arcade",
    description: "Neon solarized retro",
    css: retroArcadeCss,
  },
  {
    id: "vercel",
    name: "Vercel",
    description: "Pure black and white",
    css: vercelCss,
  },
  {
    id: "clean-slate",
    name: "Clean Slate",
    description: "Indigo accent on neutral slate",
    css: cleanSlateCss,
  },
];

export const THEME_PALETTES: ThemePalette[] = THEME_DEFINITIONS.map(
  (definition) => {
    const parsed = parseThemeCss(definition.css);
    return {
      ...definition,
      preview: previewFromVars(parsed?.light ?? {}),
    };
  }
);

export function getPalette(id: string | null | undefined): ThemePalette {
  return (
    THEME_PALETTES.find((palette) => palette.id === id) ?? THEME_PALETTES[0]
  );
}