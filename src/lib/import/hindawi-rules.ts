// Pure rules for books from the Hindawi Foundation (hindawi.org / safahat.org).
// No runtime imports, so tests can load this file directly.
//
// Hindawi prints the rights of every book on its copyright page. We republish
// a book only when the whole edition (design, cover and, for translations, the
// Arabic translation) is under CC BY 4.0 and the original work is in the public
// domain. Rights-reserved and non-commercial (CC BY-NC) books are refused.
import type { CategoryId } from "../categories";

export type HindawiRights = "cc-by" | "non-commercial" | "reserved" | "unknown";

export interface HindawiCopyright {
  rights: HindawiRights;
  title: string;
  originalTitle: string;
  author: string;
  originalAuthor: string;
  /** Year the original work first appeared, or null when the page does not say. */
  originalYear: number | null;
  /**
   * Year an older Arabic translation (not Hindawi's own) first appeared. That
   * translation is the text we would republish, so it must be old enough too.
   */
  translationYear: number | null;
  /** Language the original was written in, e.g. "الإنجليزية"; "" for Arabic originals. */
  originalLanguage: string;
  /** When only a century is given, e.g. "القرن الحادي عشر الميلادي". */
  originalCentury: string;
}

export interface HindawiTitlePage {
  author: string;
  translator: string;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Arabic-Indic and Persian digits to ASCII. */
export function asciiDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

function textOf(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
      if (entity[0] !== "#") return ENTITIES[entity.toLowerCase()] ?? match;
      const code = entity[1] === "x" || entity[1] === "X" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match;
    })
    .replace(/[‎‏‪-‮]/g, "");
}

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

/** Drops tashkeel and tatweel and folds hamza'd alefs, for matching legal wording. */
function bare(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/ـ/g, "")
    .normalize("NFC")
    .replace(/[أإآ]/g, "ا");
}

function headings(xhtml: string, tag: "h2" | "h3"): { text: string; ltr: boolean }[] {
  return [...xhtml.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`, "gi"))].map((m) => ({
    text: oneLine(textOf(m[2])),
    ltr: /dir\s*=\s*["']ltr["']/i.test(m[1]),
  }));
}

export function readCopyrightPage(xhtml: string): HindawiCopyright {
  const h2 = headings(xhtml, "h2");
  const h3 = headings(xhtml, "h3");
  const text = bare(oneLine(asciiDigits(textOf(xhtml))));

  const licensed = text.includes("رخصة المشاع الابداعي");
  const nonCommercial = /غير\s*تجاري|NonCommercial|BY-NC/i.test(text);
  const reserved = text.includes("محفوظة");
  const originalIsPublic = /(?:لل|ال)ملكية العامة/.test(text);
  const rights: HindawiRights =
    licensed && nonCommercial
      ? "non-commercial"
      : licensed && !reserved && originalIsPublic
        ? "cc-by"
        : reserved
          ? "reserved"
          : "unknown";

  // "صدر الكتاب الأصلي باللغة الإنجليزية عام 1912" / "صدر أصل هذا الكتاب باللغة الروسية عام 1888"
  // / "صدر هذا الكتاب عام 1923" (Arabic originals). Matched without tashkeel but
  // with hamzas kept, so the language reads correctly in descriptions.
  const unvowelled = oneLine(asciiDigits(textOf(xhtml))).replace(/[\u064B-\u065F\u0670\u0640]/g, "");
  const original = /صدر (?:الكتاب [اأ]لأصلي|الكتاب الاصلي|[أا]صل هذا الكتاب|هذا الكتاب)(?: باللغة (\S+))? عام (\d{3,4})/.exec(unvowelled);
  return {
    rights,
    title: h2.find((h) => !h.ltr)?.text ?? "",
    originalTitle: h2.find((h) => h.ltr)?.text ?? "",
    author: h3.find((h) => !h.ltr)?.text ?? "",
    originalAuthor: h3.find((h) => h.ltr)?.text ?? "",
    originalYear: original ? Number(original[2]) : null,
    // "صدرت هذه الترجمة عام 1953" (Hindawi's own reads "صدرت هذه الترجمة عن مؤسسة هنداوي عام …").
    translationYear: Number(/صدرت هذه الترجمة عام (\d{3,4})/.exec(unvowelled)?.[1]) || null,
    originalLanguage: original?.[1] ?? "",
    originalCentury: original
      ? ""
      : (/صدر (?:الكتاب [اأ]لأصلي|الكتاب الاصلي|[أا]صل هذا الكتاب|هذا الكتاب)[^.]*? في (القرن [^.]+?(?:الميلادي|الهجري|قبل الميلاد))/.exec(unvowelled)?.[1] ?? ""),
  };
}

/** Reads "تأليف / ترجمة" names from a Hindawi title page (fp2.xhtml). */
export function readTitlePage(xhtml: string): HindawiTitlePage {
  const role = (label: string) => {
    for (const [, inner] of xhtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
      const lines = textOf(inner)
        .split("\n")
        .map(oneLine)
        .filter(Boolean);
      if (lines[0] && bare(lines[0]) === bare(label) && lines[1]) return lines.slice(1).join(" و");
    }
    return "";
  };
  return { author: role("تأليف"), translator: role("ترجمة") };
}

/**
 * Public domain in the United States (where the site is hosted) as well as in
 * the countries Hindawi checks: the original must have been published at least
 * 96 years ago (before 1931 in 2026).
 */
export function isOldEnough(originalYear: number | null, now = new Date()): boolean {
  return originalYear !== null && originalYear >= 500 && originalYear <= now.getUTCFullYear() - 96;
}

export function republishable(copyright: HindawiCopyright, now = new Date()): string | null {
  if (copyright.rights === "non-commercial") return "رخصة غير تجارية (CC BY-NC)";
  if (copyright.rights !== "cc-by") return "حقوق النشر محفوظة";
  // An undated original that was already translated long ago is old enough,
  // and so is one dated by a century before the twentieth.
  const ancient = Boolean(copyright.originalCentury) && !copyright.originalCentury.includes("العشرين");
  const originalYear = copyright.originalYear ?? copyright.translationYear ?? (ancient ? 1800 : null);
  if (!isOldEnough(originalYear, now)) {
    return originalYear ? `صدر الأصل عام ${originalYear}، وقد يكون محمياً في أمريكا` : "سنة صدور الأصل غير معروفة";
  }
  if (copyright.translationYear !== null && !isOldEnough(copyright.translationYear, now)) {
    return `الترجمة العربية صدرت عام ${copyright.translationYear}، وقد تكون محمية في أمريكا`;
  }
  return null;
}

/** Hindawi category slugs (safahat.org/books/categories/…) in priority order. */
const CATEGORY_MAP: [string, CategoryId][] = [
  ["science.fiction", "fantasy"],
  ["detective.fiction", "mystery"],
  ["children.stories", "children"],
  ["novels", "novels"],
  ["travel.literature", "history"],
  ["biographies", "history"],
  ["history", "history"],
  ["plays", "literature"],
  ["poetry", "literature"],
  ["literature", "literature"],
  ["philosophy", "philosophy"],
  ["religions", "religion"],
  ["science", "science"],
];

export function mapHindawiCategory(slugs: string[]): CategoryId {
  for (const [slug, category] of CATEGORY_MAP) if (slugs.includes(slug)) return category;
  return "other";
}

/** A short factual description, used when no hand-written one is given. */
export function describeHindawiBook(copyright: HindawiCopyright, titlePage: HindawiTitlePage): string {
  const author = titlePage.author || copyright.author;
  const parts = [`«${copyright.title}»${author ? ` لـ${author}` : ""}`];
  if (copyright.originalLanguage && copyright.originalYear) {
    parts.push(`صدر أصله باللغة ${copyright.originalLanguage} عام ${copyright.originalYear}`);
  } else if (copyright.originalYear) {
    parts.push(`صدر أول مرة عام ${copyright.originalYear}`);
  } else if (copyright.originalCentury) {
    parts.push(`من ${copyright.originalCentury}`);
  }
  if (titlePage.translator) parts.push(`بترجمة ${titlePage.translator}`);
  return `${parts.join("، ")}. نسخة كاملة عن طبعة مؤسسة هنداوي.`;
}
