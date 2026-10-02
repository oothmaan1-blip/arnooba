// Pure rules for Gutenberg metadata (no imports besides types, so tests can
// load this file directly).
import type { CategoryId } from "../categories";

export interface Person {
  name: string;
  birth_year: number | null;
  death_year: number | null;
}

export interface GutendexBook {
  id: number;
  title: string;
  authors: Person[];
  translators?: Person[];
  editors?: Person[];
  summaries?: string[];
  subjects: string[];
  bookshelves: string[];
  languages: string[];
  copyright: boolean | null;
  media_type: string;
  formats: Record<string, string>;
  download_count: number;
}

/** "Austen, Jane" → "Jane Austen"; "Wells, H. G. (Herbert George)" → "H. G. Wells". */
export function personName(name: string): string {
  const clean = name.replace(/\s*\([^)]*\)/g, "").trim();
  const [last, first] = clean.split(", ");
  return first ? `${first} ${last}`.trim() : clean;
}

/**
 * Gutenberg only guarantees US public domain. Keep a book only if everyone
 * credited on it died long enough ago for life+70 countries as well.
 */
export function isSafePublicDomain(book: GutendexBook, now = new Date()): boolean {
  if (book.copyright !== false || book.authors.length === 0) return false;
  const cutoff = now.getFullYear() - 71;
  const people = [...book.authors, ...(book.translators ?? []), ...(book.editors ?? [])];
  return people.every((p) => {
    if (/^(anonymous|unknown)$/i.test(p.name.trim())) return true;
    if (p.death_year != null) return p.death_year <= cutoff;
    return p.birth_year != null && p.birth_year <= cutoff - 110;
  });
}

// Shelves like "Category: British Literature" are applied to almost every
// classic, so they say nothing about the genre.
const GENERIC_SHELF = /^category: (classics of literature|classics of antiquity|[\w\s&-]*literature|best books.*|reading lists?.*)$/i;

const CATEGORY_RULES: [CategoryId, RegExp][] = [
  [
    "fantasy",
    /fantasy|fairy tales|fairies|science fiction|magic|imaginary (places|voyages|wars|societies)|ghost stories|supernatural|horror tales|vampires|monsters|time travel|utopias|dystopias|interplanetary|life on other planets|voyages to the moon|wizards|dragons|mermaids|elves/i,
  ],
  ["children", /juvenile|children|nursery|young adult/i],
  ["mystery", /detective|mystery|crime|murder|sherlock/i],
  ["novels", /fiction|novels?\b|short stories|love stories|adventure stories|romance|fantasy|horror tales/i],
  ["history", /biograph|autobiograph|memoirs|diaries/i],
  ["literature", /poetry|poems|drama|plays|tragedies|comedies|essays|sonnets|verse|literature|letters/i],
  ["philosophy", /philosophy|ethics|psychology|political science|economics|sociology|logic|stoics/i],
  ["religion", /religion|bible|christian|theology|islam|buddhis|mythology|sacred|church|hindu/i],
  ["science", /science|mathematic|physics|chemistry|biology|astronomy|natural history|medicine|evolution|botany|zoology|geology|technology/i],
  ["history", /history|war\b|voyages|travel|antiquities|civilization/i],
];

export function mapCategory(subjects: string[], shelves: string[]): CategoryId {
  const text = [...shelves.filter((s) => !GENERIC_SHELF.test(s)), ...subjects].join(" | ");
  for (const [category, pattern] of CATEGORY_RULES) {
    if (pattern.test(text)) return category;
  }
  return "other";
}

export function cleanTitle(title: string): string {
  return title
    .replace(/\s*:?\s*\$[a-z]\s+/g, ": ") // MARC subfield markers such as "$b"
    .replace(/\s*[\r\n]+\s*/g, ": ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

export function summaryOf(book: GutendexBook): string {
  return (book.summaries?.[0] ?? "")
    .replace(/\s*\(This is an automatically generated summary\.\)\s*$/i, "")
    .trim();
}
