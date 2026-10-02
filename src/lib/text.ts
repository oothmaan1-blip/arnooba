// Text helpers shared by server code, client code and tests.
// Keep this module free of imports: `node --test` loads it directly.

/**
 * Folds the spelling variants people mix up when typing Arabic (hamza forms,
 * taa marbuta, alef maqsura, tashkeel, tatweel, Persian letters, Eastern
 * digits) and lowercases Latin text, so "إبن خلدون" finds "ابن خلدون".
 */
export function normalizeText(input: string): string {
  return input
    .normalize("NFKD") // splits أ إ آ ؤ ئ into base letter + mark, unpacks ligatures
    .replace(/\p{M}+/gu, "") // drops those marks, tashkeel and Latin accents
    .toLowerCase()
    .replace(/\u0640/g, "") // tatweel
    .replace(/\u0671/g, "\u0627") // ٱ → ا
    .replace(/[\u0649\u06CC]/g, "\u064A") // ى ی → ي
    .replace(/\u0629/g, "\u0647") // ة → ه
    .replace(/\u06A9/g, "\u0643") // ک → ك
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Splits a search query into normalized terms. A leading "ال" is dropped from
 * longer Arabic words so "الحمامة" also matches titles written "حمامة".
 */
export function searchTerms(query: string): string[] {
  const terms = normalizeText(query.slice(0, 200))
    .split(" ")
    .filter(Boolean)
    .map((t) => (t.length >= 5 && t.startsWith("\u0627\u0644") ? t.slice(2) : t))
    .map((t) => t.slice(0, 40));
  return [...new Set(terms)].slice(0, 8);
}

/** Escapes LIKE wildcards; normalized terms never contain them, but be safe. */
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => "\\" + c);
}

/** URL-friendly slug that keeps Arabic letters as they are (minus tashkeel). */
export function slugify(input: string, max = 60): string {
  const slug = input
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, max).replace(/-+$/, "") || "book";
}

/** Reads the numeric id from a "/book/12-some-title" style segment. */
export function parseIdParam(param: string | undefined): number | null {
  const m = /^(\d{1,9})(?:-|$)/.exec(param ?? "");
  return m ? Number(m[1]) : null;
}

/** A download file name that is safe on Windows, macOS and Linux. */
export function fileNameFor(title: string, author: string, ext: string): string {
  const base = [title, author]
    .filter(Boolean)
    .join(" - ")
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
    .trim();
  return `${base || "book"}.${ext}`;
}

/** RFC 6266 attachment header with an ASCII fallback and a UTF-8 file name. */
export function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

type Forms = { one: string; two: string; few: string; many: string };

/** Arabic number + counted noun: كتاب واحد، كتابان، ٣ كتب، ١١ كتاباً… */
export function arCount(n: number, forms: Forms): string {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  const lastTwo = n % 100;
  const word = lastTwo >= 3 && lastTwo <= 10 ? forms.few : forms.many;
  return `${formatNumber(n)} ${word}`;
}

export const BOOK_FORMS: Forms = { one: "كتاب واحد", two: "كتابان", few: "كتب", many: "كتاب" };
export const PAGE_FORMS: Forms = { one: "صفحة واحدة", two: "صفحتان", few: "صفحات", many: "صفحة" };
export const DOWNLOAD_FORMS: Forms = { one: "تحميل واحد", two: "تحميلان", few: "تحميلات", many: "تحميل" };
export const READ_FORMS: Forms = { one: "قراءة واحدة", two: "قراءتان", few: "قراءات", many: "قراءة" };

export function pagesLabel(pages: number | null, approx: boolean): string {
  if (!pages || pages < 1) return "";
  return (approx ? "حوالي " : "") + arCount(pages, PAGE_FORMS);
}

/** Collapses whitespace and cuts at a word boundary for meta descriptions. */
export function excerpt(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd() + "…";
}
