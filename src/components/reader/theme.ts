export type ReaderTheme = "light" | "sepia" | "dark";

export const READER_THEMES: Record<
  ReaderTheme,
  { label: string; bg: string; fg: string; muted: string; line: string; accent: string }
> = {
  light: { label: "فاتح", bg: "#fffaf2", fg: "#2f2116", muted: "#6c5643", line: "#e8dbc6", accent: "#85552b" },
  sepia: { label: "ورقي", bg: "#f0e2c8", fg: "#3d2a1a", muted: "#6c5541", line: "#dcc7a5", accent: "#74481f" },
  dark: { label: "ليلي", bg: "#17110b", fg: "#efe3d0", muted: "#b49d82", line: "#33261a", accent: "#d9ab78" },
};

export const THEME_ORDER: ReaderTheme[] = ["light", "sepia", "dark"];

export interface ReaderPrefs {
  theme: ReaderTheme;
  fontScale: number;
  zoom: number;
}

const PREFS_KEY = "arnooba:reader:v1";

export function loadPrefs(): ReaderPrefs {
  const siteDark = document.documentElement.getAttribute("data-theme") === "dark";
  const fallback: ReaderPrefs = { theme: siteDark ? "dark" : "light", fontScale: 100, zoom: 1 };
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null") as Partial<ReaderPrefs> | null;
    if (!saved) return fallback;
    return {
      theme: saved.theme && saved.theme in READER_THEMES ? saved.theme : fallback.theme,
      fontScale: clamp(Number(saved.fontScale) || 100, 70, 220),
      zoom: clamp(Number(saved.zoom) || 1, 0.5, 3),
    };
  } catch {
    return fallback;
  }
}

export function savePrefs(prefs: ReaderPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // not persisted; fine
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
