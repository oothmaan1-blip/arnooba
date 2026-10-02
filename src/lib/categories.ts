export const CATEGORIES = [
  { id: "novels", ar: "روايات وقصص", en: "Fiction" },
  { id: "fantasy", ar: "خيال وفانتازيا", en: "Fantasy & sci-fi" },
  { id: "mystery", ar: "بوليسية وغموض", en: "Mystery & crime" },
  { id: "literature", ar: "أدب وشعر", en: "Literature & poetry" },
  { id: "history", ar: "تاريخ وسِيَر", en: "History & biography" },
  { id: "philosophy", ar: "فكر وفلسفة", en: "Philosophy & thought" },
  { id: "religion", ar: "دين", en: "Religion" },
  { id: "science", ar: "علوم", en: "Science" },
  { id: "children", ar: "أطفال", en: "Children" },
  { id: "other", ar: "منوّعات", en: "Other" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export function isCategory(value: unknown): value is CategoryId {
  return CATEGORIES.some((c) => c.id === value);
}

export function categoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.ar ?? "منوّعات";
}

export const LANGS = {
  ar: { label: "كتب عربية", title: "الكتب العربية", short: "عربي", path: "/ar" },
  en: { label: "كتب إنكليزية", title: "الكتب الإنكليزية", short: "إنكليزي", path: "/en" },
} as const;

export type Lang = keyof typeof LANGS;

export function isLang(value: unknown): value is Lang {
  return value === "ar" || value === "en";
}

export const LICENSES = [
  { id: "public-domain", label: "ملكية عامة" },
  { id: "cc-by", label: "CC BY 4.0" },
  { id: "cc-by-sa", label: "CC BY-SA" },
  { id: "permission", label: "بإذن المؤلف أو الناشر" },
] as const;

export function licenseLabel(id: string): string {
  return LICENSES.find((l) => l.id === id)?.label ?? id;
}
