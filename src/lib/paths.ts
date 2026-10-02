// URL builders. Pure functions, safe to import from client components.
import type { Lang } from "./categories";
import { slugify } from "./text";

type Named = { id: number; title: string };

export function bookPath(book: Named): string {
  return `/book/${book.id}-${slugify(book.title)}`;
}

export function readPath(book: Named, format?: "pdf" | "epub"): string {
  return `/read/${book.id}-${slugify(book.title)}${format ? `?format=${format}` : ""}`;
}

export function downloadPath(book: { id: number }, format: "pdf" | "epub"): string {
  return `/api/download/${book.id}?format=${format}`;
}

export function langPath(lang: Lang, query: Record<string, string | number | undefined> = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "" && !(key === "page" && Number(value) === 1)) {
      params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return `/${lang}${qs ? `?${qs}` : ""}`;
}
