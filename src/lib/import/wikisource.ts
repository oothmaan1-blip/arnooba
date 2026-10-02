// Imports Arabic public-domain books from Arabic Wikisource (ويكي مصدر) via
// the Wikisource export tool, which builds a clean EPUB of a whole work.
// The texts are public domain; the transcription is CC BY-SA.
import { createBook, getBookBySourceId } from "../books";
import type { CategoryId } from "../categories";
import { generateCover } from "../cover-art";
import { estimatePages, inspectEpub } from "../epub";
import { fetchFile } from "../fetch-file";
import { sniff } from "../magic";
import { scanEpub } from "../scan";
import { deleteObject, newKey, putObject } from "../storage";
import { contentDisposition, fileNameFor } from "../text";
import type { ImportResult } from "./types";
import { WIKISOURCE_STARTER } from "./wikisource-starter";

const EXPORT_URL = "https://ws-export.wmcloud.org/";

export interface WikisourceEntry {
  page: string;
  title?: string;
  author?: string;
  category: CategoryId;
  description?: string;
  /** Defaults to CC BY-SA (Wikisource's own license); some hosted translations are CC BY. */
  license?: "cc-by-sa" | "cc-by" | "public-domain";
  /** Checked by hand to be the whole work. */
  complete?: boolean;
  film?: string;
}

export function wikisourceUrl(page: string): string {
  return `https://ar.wikisource.org/wiki/${encodeURIComponent(page.replace(/ /g, "_"))}`;
}

export async function importWikisourceBook(entry: WikisourceEntry): Promise<ImportResult> {
  const page = entry.page.trim().replace(/_/g, " ");
  if (!page || page.length > 200) return { status: "skipped", reason: "اسم الصفحة غير صالح" };
  const sourceId = `wikisource:ar:${page}`;
  const existing = await getBookBySourceId(sourceId);
  if (existing) return { status: "exists", book: existing };

  const params = new URLSearchParams({ lang: "ar", page, format: "epub-3" });
  const epub = await fetchFile(`${EXPORT_URL}?${params}`, 60 * 1024 * 1024, 240_000).catch(() => null);
  if (!epub || sniff(epub.subarray(0, 1024)) !== "epub") {
    return { status: "skipped", reason: "تعذّر تصدير الصفحة من ويكي مصدر (تأكد من الاسم)" };
  }
  const threat = await scanEpub(epub).catch(() => "ملف تالف");
  if (threat) return { status: "skipped", reason: `محتوى نشط: ${threat}` };
  const info = await inspectEpub(epub);
  if (info.textLength < 4000) {
    return { status: "skipped", reason: "النص قصير جداً: الصفحة غالباً فهرس أو صفحة توضيح" };
  }

  const title = entry.title?.trim() || info.title || page;
  const author = entry.author?.trim() || info.creator || "";
  let epubKey: string | null = null;
  let coverKey: string | null = null;
  try {
    epubKey = newKey("epub");
    await putObject(epubKey, epub, {
      contentType: "application/epub+zip",
      disposition: contentDisposition(fileNameFor(title, author, "epub")),
    });
    const cover = await generateCover({ title, author, category: entry.category }).catch(() => null);
    if (cover) {
      coverKey = newKey("cover", "jpg");
      await putObject(coverKey, cover, { contentType: "image/jpeg" });
    }
    const book = await createBook({
      lang: "ar",
      title,
      author,
      description: entry.description?.trim() ?? "",
      category: entry.category,
      year: "",
      coverKey,
      pdfKey: null,
      pdfSize: null,
      epubKey,
      epubSize: epub.byteLength,
      pages: estimatePages(info.textLength, "ar"),
      pagesApprox: true,
      source: "ويكي مصدر",
      sourceId,
      sourceUrl: wikisourceUrl(page),
      license: entry.license ?? "cc-by-sa",
      film: entry.film ?? "",
      complete: entry.complete ?? false,
      popularity: 0,
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

export function starterEntry(page: string): WikisourceEntry | undefined {
  return WIKISOURCE_STARTER.find((e) => e.page === page);
}
