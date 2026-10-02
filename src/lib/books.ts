import { sql } from "./db";
import { CATEGORIES, isCategory, type CategoryId, type Lang } from "./categories";
import { escapeLike, normalizeText, searchTerms } from "./text";

export interface Book {
  id: number;
  lang: Lang;
  title: string;
  author: string;
  description: string;
  category: CategoryId;
  year: string;
  coverKey: string | null;
  pdfKey: string | null;
  pdfSize: number | null;
  epubKey: string | null;
  epubSize: number | null;
  pages: number | null;
  pagesApprox: boolean;
  source: string;
  sourceId: string | null;
  sourceUrl: string;
  license: string;
  /** Film adaptation note, e.g. "Journey to the Center of the Earth (2008)"; empty if none. */
  film: string;
  /** Checked to be the whole work (not a sample or a partial transcription). */
  complete: boolean;
  popularity: number;
  downloads: number;
  reads: number;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type BookInput = Omit<Book, "id" | "downloads" | "reads" | "createdAt" | "updatedAt">;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

interface BookRow {
  id: number;
  lang: Lang;
  title: string;
  author: string;
  description: string;
  category: string;
  year: string;
  cover_key: string | null;
  pdf_key: string | null;
  pdf_size: number | null;
  epub_key: string | null;
  epub_size: number | null;
  pages: number | null;
  pages_approx: boolean;
  source: string;
  source_id: string | null;
  source_url: string;
  license: string;
  film: string;
  complete: boolean;
  popularity: number;
  downloads: number;
  reads: number;
  published: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  total_count?: number;
}

const COLUMNS =
  "id, lang, title, author, description, category, year, cover_key, pdf_key, pdf_size, epub_key, epub_size, " +
  "pages, pages_approx, source, source_id, source_url, license, film, complete, popularity, downloads, reads, published, created_at, updated_at";

function toBook(r: BookRow): Book {
  return {
    id: r.id,
    lang: r.lang,
    title: r.title,
    author: r.author,
    description: r.description,
    category: isCategory(r.category) ? r.category : "other",
    year: r.year,
    coverKey: r.cover_key,
    pdfKey: r.pdf_key,
    pdfSize: r.pdf_size,
    epubKey: r.epub_key,
    epubSize: r.epub_size,
    pages: r.pages,
    pagesApprox: r.pages_approx,
    source: r.source,
    sourceId: r.source_id,
    sourceUrl: r.source_url,
    license: r.license,
    film: r.film,
    complete: r.complete,
    popularity: r.popularity,
    downloads: r.downloads,
    reads: r.reads,
    published: r.published,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

export const SORTS = {
  popular: "الأكثر قراءة",
  latest: "الأحدث",
  title: "حسب العنوان",
} as const;

export type SortKey = keyof typeof SORTS;

export function isSort(value: unknown): value is SortKey {
  return typeof value === "string" && value in SORTS;
}

// Whitelisted ORDER BY clauses: user input only ever picks a key.
const ORDER_BY: Record<SortKey, string> = {
  popular: "(downloads + reads) DESC, popularity DESC, id DESC",
  latest: "created_at DESC, id DESC",
  title: "lower(title) ASC, id ASC",
};

function paging(page?: number, pageSize?: number) {
  const size = Math.min(100, Math.max(1, Math.floor(pageSize ?? 24)));
  const current = Math.min(10_000, Math.max(1, Math.floor(page ?? 1)));
  return { page: current, pageSize: size, offset: (current - 1) * size };
}

interface Filters {
  lang?: Lang;
  category?: CategoryId;
  /** Only books that were made into films. */
  film?: boolean;
  includeUnpublished?: boolean;
}

function filterClauses(filters: Filters, params: unknown[]): string[] {
  const where: string[] = [];
  if (!filters.includeUnpublished) where.push("published");
  if (filters.lang) {
    params.push(filters.lang);
    where.push(`lang = $${params.length}`);
  }
  if (filters.category) {
    params.push(filters.category);
    where.push(`category = $${params.length}`);
  }
  if (filters.film) where.push("film <> ''");
  return where;
}

/**
 * Runs a paged query. `orderBy` may reference `orderParams` as placeholders
 * numbered after the WHERE parameters.
 */
async function pageOf(
  where: string[],
  whereParams: unknown[],
  orderBy: string,
  orderParams: unknown[],
  p: ReturnType<typeof paging>,
): Promise<Page<Book>> {
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const params = [...whereParams, ...orderParams];
  const rows = await sql<BookRow>(
    `SELECT ${COLUMNS}, COUNT(*) OVER()::int AS total_count FROM books ${whereSql}
     ORDER BY ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, p.pageSize, p.offset],
  );
  let total = rows[0]?.total_count ?? 0;
  if (!rows.length && p.page > 1) {
    const [count] = await sql<{ n: number }>(`SELECT COUNT(*)::int AS n FROM books ${whereSql}`, whereParams);
    total = count?.n ?? 0;
  }
  return { items: rows.map(toBook), total, page: p.page, pageSize: p.pageSize };
}

export async function listBooks(
  opts: Filters & { sort?: SortKey; page?: number; pageSize?: number } = {},
): Promise<Page<Book>> {
  const params: unknown[] = [];
  const where = filterClauses(opts, params);
  return pageOf(where, params, ORDER_BY[opts.sort ?? "popular"], [], paging(opts.page, opts.pageSize));
}

export async function searchBooks(
  query: string,
  opts: Filters & { page?: number; pageSize?: number } = {},
): Promise<Page<Book>> {
  const p = paging(opts.page, opts.pageSize);
  const terms = searchTerms(query);
  if (!terms.length) return { items: [], total: 0, page: p.page, pageSize: p.pageSize };

  const params: unknown[] = [];
  const where = terms.map((term) => {
    params.push(`%${escapeLike(term)}%`);
    return `search_text LIKE $${params.length}`;
  });
  where.push(...filterClauses(opts, params));
  // search_text starts with the title, so an earlier match ranks higher.
  const orderBy = `strpos(search_text, $${params.length + 1}) ASC, ${ORDER_BY.popular}`;
  return pageOf(where, params, orderBy, [terms[0]], p);
}

export async function getBook(id: number, opts: { includeUnpublished?: boolean } = {}): Promise<Book | null> {
  if (!Number.isSafeInteger(id) || id < 1) return null;
  const rows = await sql<BookRow>(
    `SELECT ${COLUMNS} FROM books WHERE id = $1 ${opts.includeUnpublished ? "" : "AND published"}`,
    [id],
  );
  return rows[0] ? toBook(rows[0]) : null;
}

export async function getBookBySourceId(sourceId: string): Promise<Book | null> {
  const rows = await sql<BookRow>(`SELECT ${COLUMNS} FROM books WHERE source_id = $1`, [sourceId]);
  return rows[0] ? toBook(rows[0]) : null;
}

export async function similarBooks(book: Book, limit = 6): Promise<Book[]> {
  const rows = await sql<BookRow>(
    `SELECT ${COLUMNS} FROM books
     WHERE published AND lang = $1 AND id <> $2
     ORDER BY (category = $3) DESC, ${ORDER_BY.popular} LIMIT $4`,
    [book.lang, book.id, book.category, limit],
  );
  return rows.map(toBook);
}

export async function countByLang(): Promise<Record<Lang, number>> {
  const rows = await sql<{ lang: Lang; n: number }>(
    "SELECT lang, COUNT(*)::int AS n FROM books WHERE published GROUP BY lang",
  );
  const counts: Record<Lang, number> = { ar: 0, en: 0 };
  for (const row of rows) counts[row.lang] = row.n;
  return counts;
}

export async function categoryCounts(lang: Lang): Promise<Partial<Record<CategoryId, number>>> {
  const rows = await sql<{ category: string; n: number }>(
    "SELECT category, COUNT(*)::int AS n FROM books WHERE published AND lang = $1 GROUP BY category",
    [lang],
  );
  const counts: Partial<Record<CategoryId, number>> = {};
  for (const row of rows) if (isCategory(row.category)) counts[row.category] = row.n;
  return counts;
}

export async function filmCount(lang: Lang): Promise<number> {
  const [row] = await sql<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM books WHERE published AND lang = $1 AND film <> ''",
    [lang],
  );
  return row?.n ?? 0;
}

function searchTextFor(book: Pick<BookInput, "title" | "author" | "category" | "film">): string {
  const category = CATEGORIES.find((c) => c.id === book.category);
  const film = book.film ? `${book.film} فيلم film` : "";
  return normalizeText([book.title, book.author, category?.ar ?? "", category?.en ?? "", film].join(" "));
}

function inputParams(b: BookInput): unknown[] {
  return [
    b.lang,
    b.title,
    b.author,
    b.description,
    b.category,
    b.year,
    b.coverKey,
    b.pdfKey,
    b.pdfSize,
    b.epubKey,
    b.epubSize,
    b.pages,
    b.pagesApprox,
    b.source,
    b.sourceId,
    b.sourceUrl,
    b.license,
    b.popularity,
    b.published,
    searchTextFor(b),
    b.film,
    b.complete,
  ];
}

export async function createBook(input: BookInput): Promise<Book> {
  const rows = await sql<BookRow>(
    `INSERT INTO books (lang, title, author, description, category, year, cover_key, pdf_key, pdf_size,
       epub_key, epub_size, pages, pages_approx, source, source_id, source_url, license, popularity, published, search_text,
       film, complete)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
     RETURNING ${COLUMNS}`,
    inputParams(input),
  );
  return toBook(rows[0]);
}

export async function updateBook(id: number, patch: Partial<BookInput>): Promise<Book | null> {
  const current = await getBook(id, { includeUnpublished: true });
  if (!current) return null;
  const next: BookInput = { ...current, ...patch };
  const rows = await sql<BookRow>(
    `UPDATE books SET lang = $1, title = $2, author = $3, description = $4, category = $5, year = $6,
       cover_key = $7, pdf_key = $8, pdf_size = $9, epub_key = $10, epub_size = $11, pages = $12,
       pages_approx = $13, source = $14, source_id = $15, source_url = $16, license = $17,
       popularity = $18, published = $19, search_text = $20, film = $21, complete = $22, updated_at = now()
     WHERE id = $23 RETURNING ${COLUMNS}`,
    [...inputParams(next), id],
  );
  return rows[0] ? toBook(rows[0]) : null;
}

export async function deleteBook(id: number): Promise<Book | null> {
  const rows = await sql<BookRow>(`DELETE FROM books WHERE id = $1 RETURNING ${COLUMNS}`, [id]);
  return rows[0] ? toBook(rows[0]) : null;
}

export async function bumpCounter(id: number, counter: "downloads" | "reads"): Promise<void> {
  const column = counter === "downloads" ? "downloads" : "reads";
  await sql(`UPDATE books SET ${column} = ${column} + 1 WHERE id = $1 AND published`, [id]);
}

export async function adminStats() {
  const [row] = await sql<{
    ar: number;
    en: number;
    hidden: number;
    downloads: number;
    reads: number;
  }>(
    `SELECT COUNT(*) FILTER (WHERE lang = 'ar' AND published)::int AS ar,
            COUNT(*) FILTER (WHERE lang = 'en' AND published)::int AS en,
            COUNT(*) FILTER (WHERE NOT published)::int AS hidden,
            COALESCE(SUM(downloads), 0)::int AS downloads,
            COALESCE(SUM(reads), 0)::int AS reads
     FROM books`,
  );
  return row;
}

/** Another edition of the same work already in the catalog (same title and author). */
export async function findSameWork(lang: Lang, title: string, author: string): Promise<Book | null> {
  const rows = await sql<BookRow>(
    `SELECT ${COLUMNS} FROM books WHERE lang = $1 AND lower(title) = lower($2) AND lower(author) = lower($3) LIMIT 1`,
    [lang, title, author],
  );
  return rows[0] ? toBook(rows[0]) : null;
}

export async function booksWithoutCover(lang: Lang): Promise<Book[]> {
  const rows = await sql<BookRow>(`SELECT ${COLUMNS} FROM books WHERE lang = $1 AND cover_key IS NULL ORDER BY id`, [lang]);
  return rows.map(toBook);
}

export async function sourceIdsWithPrefix(prefix: string): Promise<string[]> {
  const rows = await sql<{ source_id: string }>(
    "SELECT source_id FROM books WHERE source_id LIKE $1",
    [`${escapeLike(prefix)}%`],
  );
  return rows.map((r) => r.source_id);
}

export async function sitemapEntries(): Promise<{ id: number; title: string; updatedAt: Date }[]> {
  const rows = await sql<{ id: number; title: string; updated_at: Date | string }>(
    "SELECT id, title, updated_at FROM books WHERE published ORDER BY id LIMIT 45000",
  );
  return rows.map((r) => ({ id: r.id, title: r.title, updatedAt: new Date(r.updated_at) }));
}
