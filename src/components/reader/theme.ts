export type ReaderTheme = "light" | "sepia" | "dark" | "oled" | "arnooba";

export const READER_THEMES: Record<
  ReaderTheme,
  { label: string; bg: string; fg: string; muted: string; line: string; accent: string }
> = {
  light: { label: "فاتح", bg: "#fffaf2", fg: "#2f2116", muted: "#6c5643", line: "#e8dbc6", accent: "#85552b" },
  sepia: { label: "ورقي", bg: "#f0e2c8", fg: "#3d2a1a", muted: "#6c5541", line: "#dcc7a5", accent: "#74481f" },
  dark: { label: "ليلي جوزي", bg: "#17110b", fg: "#efe3d0", muted: "#b49d82", line: "#33261a", accent: "#d9ab78" },
  oled: { label: "أسود OLED", bg: "#000000", fg: "#dedede", muted: "#a7a7a7", line: "#292929", accent: "#c4c4c4" },
  arnooba: { label: "أرنوبة", bg: "#1b1a35", fg: "#eeedff", muted: "#b7b5d8", line: "#38375d", accent: "#aebaff" },
};

export const FONT_OPTIONS = {
  system: { label: "IBM Plex Arabic · أرنوبة", css: '"IBM Plex Sans Arabic", system-ui, sans-serif', variable: "--font-plex", fontFace: null },
  amiri: { label: "Amiri · نسخي", css: '"Amiri", "Noto Naskh Arabic", "Times New Roman", serif', variable: null, fontFace: "Amiri" },
  cairo: { label: "Cairo", css: '"Cairo", "Noto Sans Arabic", Arial, sans-serif', variable: null, fontFace: "Cairo" },
  tajawal: { label: "Tajawal", css: '"Tajawal", "Noto Sans Arabic", Arial, sans-serif', variable: null, fontFace: "Tajawal" },
} as const;

export type ReaderFont = keyof typeof FONT_OPTIONS;

export interface ReaderPrefs {
  theme: ReaderTheme;
  fontScale: number;
  zoom: number;
  font: ReaderFont;
  lineHeight: number;
  pageMargin: number;
}

const PREFS_KEY = "arnooba:reader:v1";

export function loadPrefs(): ReaderPrefs {
  const siteTheme = document.documentElement.getAttribute("data-theme");
  const fallback: ReaderPrefs = {
    theme: siteTheme === "arnooba" ? "arnooba" : siteTheme === "dark" ? "dark" : "light",
    fontScale: 100,
    zoom: 1,
    font: "system",
    lineHeight: 1.8,
    pageMargin: 3,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null") as Partial<ReaderPrefs> | null;
    if (!saved) return fallback;
    return {
      theme: saved.theme && saved.theme in READER_THEMES ? saved.theme : fallback.theme,
      fontScale: clamp(Number(saved.fontScale) || 100, 70, 220),
      zoom: clamp(Number(saved.zoom) || 1, 0.5, 3),
      font: saved.font && saved.font in FONT_OPTIONS ? saved.font : fallback.font,
      lineHeight: [1.6, 1.8, 2, 2.2].includes(Number(saved.lineHeight)) ? Number(saved.lineHeight) : fallback.lineHeight,
      pageMargin: [1, 3, 5, 7].includes(Number(saved.pageMargin)) ? Number(saved.pageMargin) : fallback.pageMargin,
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
