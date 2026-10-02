// Imports public-domain books from Project Gutenberg through the Gutendex API.
import { createBook, findSameWork, getBookBySourceId } from "../books";
import { estimatePages, inspectEpub } from "../epub";
import { TOO_LARGE, fetchFile, fetchJson, sleep } from "../fetch-file";
import { sniff } from "../magic";
import { scanEpub } from "../scan";
import { deleteObject, newKey, putObject } from "../storage";
import { contentDisposition, fileNameFor } from "../text";
import {
  cleanTitle,
  isSafePublicDomain,
  mapCategory,
  personName,
  summaryOf,
  type GutendexBook,
} from "./gutenberg-rules";
import { parseGutenbergRdf } from "./gutenberg-rdf";
import type { ImportResult } from "./types";

const API = (process.env.GUTENDEX_URL || "https://gutendex.com").replace(/\/+$/, "");

/** File links come from the Gutendex response; only follow them to gutenberg.org. */
function gutenbergFileUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)gutenberg\.org$/.test(url.hostname) ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function fetchGutendexPage(lang: "en" | "ar", page: number, topic = "") {
  const params = new URLSearchParams({
    languages: lang,
    sort: "popular",
    copyright: "false",
    mime_type: "application/epub",
    page: String(page),
  });
  if (topic) params.set("topic", topic);
  const data = await fetchJson<{ next: string | null; results: GutendexBook[] }>(`${API}/books/?${params}`);
  return { books: data.results, hasNext: Boolean(data.next) };
}

/**
 * One book's metadata, read from its official RDF record on gutenberg.org;
 * falls back to Gutendex (a community API that is sometimes overloaded).
 */
export async function fetchGutendexBook(id: number): Promise<GutendexBook> {
  try {
    const rdf = await fetchFile(`https://www.gutenberg.org/cache/epub/${id}/pg${id}.rdf`, 2 * 1024 * 1024, 60_000);
    return parseGutenbergRdf(id, new TextDecoder().decode(rdf));
  } catch {
    return fetchJson<GutendexBook>(`${API}/books/${id}/`, 90_000);
  }
}

export async function importGutenbergBook(gb: GutendexBook): Promise<ImportResult> {
  const sourceId = `gutenberg:${gb.id}`;
  const existing = await getBookBySourceId(sourceId);
  if (existing) return { status: "exists", book: existing };

  if (gb.media_type !== "Text") return { status: "skipped", reason: "ليس كتاباً نصياً" };
  if (!isSafePublicDomain(gb)) return { status: "skipped", reason: "قد يكون محمياً بحقوق النشر خارج أمريكا" };
  const lang = gb.languages.includes("ar") ? "ar" : gb.languages.includes("en") ? "en" : null;
  if (!lang) return { status: "skipped", reason: "لغة غير مدعومة" };
  const epubUrl = gutenbergFileUrl(gb.formats["application/epub+zip"]);
  if (!epubUrl) return { status: "skipped", reason: "لا توجد نسخة EPUB" };

  const title = cleanTitle(gb.title);
  const author = gb.authors.map((a) => personName(a.name)).join(lang === "ar" ? " و" : ", ");
  // Gutenberg often has several editions of one work; keep the first.
  const sameWork = await findSameWork(lang, title, author);
  if (sameWork) return { status: "exists", book: sameWork };
  let epub: Uint8Array;
  try {
    epub = await fetchFile(epubUrl, 80 * 1024 * 1024);
  } catch (err) {
    // Heavily illustrated editions can be huge; fall back to the text-only EPUB.
    if (!(err instanceof Error) || err.message !== TOO_LARGE) throw err;
    epub = await fetchFile(`https://www.gutenberg.org/ebooks/${gb.id}.epub.noimages`, 80 * 1024 * 1024);
  }
  if (sniff(epub.subarray(0, 1024)) !== "epub") return { status: "skipped", reason: "ملف EPUB غير صالح" };
  const threat = await scanEpub(epub).catch(() => "ملف تالف");
  if (threat) return { status: "skipped", reason: `محتوى نشط: ${threat}` };
  const info = await inspectEpub(epub).catch(() => null);

  let epubKey: string | null = null;
  let coverKey: string | null = null;
  try {
    epubKey = newKey("epub");
    await putObject(epubKey, epub, {
      contentType: "application/epub+zip",
      disposition: contentDisposition(fileNameFor(title, author, "epub")),
    });

    const coverUrl = gutenbergFileUrl(gb.formats["image/jpeg"]);
    const cover = coverUrl ? await fetchFile(coverUrl, 5 * 1024 * 1024).catch(() => null) : null;
    const coverKind = cover ? sniff(cover.subarray(0, 64)) : null;
    if (cover && (coverKind === "jpeg" || coverKind === "png")) {
      coverKey = newKey("cover", coverKind === "png" ? "png" : "jpg");
      await putObject(coverKey, cover, { contentType: coverKind === "png" ? "image/png" : "image/jpeg" });
    }

    const book = await createBook({
      lang,
      title,
      author,
      description: summaryOf(gb),
      category: mapCategory(gb.subjects, gb.bookshelves),
      year: "",
      coverKey,
      pdfKey: null,
      pdfSize: null,
      epubKey,
      epubSize: epub.byteLength,
      pages: info ? estimatePages(info.textLength, lang) : null,
      pagesApprox: true,
      source: "Project Gutenberg",
      sourceId,
      sourceUrl: `https://www.gutenberg.org/ebooks/${gb.id}`,
      license: "public-domain",
      film: "",
      complete: true,
      popularity: gb.download_count ?? 0,
      published: true,
    });
    return { status: "imported", book };
  } catch (err) {
    await deleteObject(epubKey);
    await deleteObject(coverKey);
    const raced = await getBookBySourceId(sourceId);
    if (raced) return { status: "exists", book: raced };
    throw err;
  }
}

export interface BatchResult {
  imported: { id: number; title: string }[];
  existing: number;
  skipped: number;
  failed: { title: string; reason: string }[];
  nextPage: number | null;
}

/** Imports up to `limit` new books from one Gutendex page, optionally filtered by topic. */
export async function importGutenbergBatch(
  lang: "en" | "ar",
  page: number,
  limit: number,
  topic = "",
): Promise<BatchResult> {
  const { books, hasNext } = await fetchGutendexPage(lang, page, topic);
  const result: BatchResult = { imported: [], existing: 0, skipped: 0, failed: [], nextPage: null };
  let stoppedEarly = false;
  for (const gb of books) {
    if (result.imported.length >= limit) {
      stoppedEarly = true;
      break;
    }
    try {
      const outcome = await importGutenbergBook(gb);
      if (outcome.status === "imported") {
        result.imported.push({ id: outcome.book.id, title: outcome.book.title });
        await sleep(300); // be gentle with gutenberg.org
      } else if (outcome.status === "exists") {
        result.existing++;
      } else {
        result.skipped++;
      }
    } catch (err) {
      result.failed.push({ title: cleanTitle(gb.title), reason: err instanceof Error ? err.message : String(err) });
    }
  }
  result.nextPage = stoppedEarly ? page : hasNext ? page + 1 : null;
  return result;
}
