// Imports complete Arabic books from the Hindawi Foundation (hindawi.org, now
// safahat.org). Only books whose copyright page puts the whole edition under
// CC BY 4.0, with a public-domain original published before 1931, are taken;
// the rules live in hindawi-rules.ts. The EPUB is kept as published (with its
// copyright page, which carries the attribution), minus font files no
// stylesheet uses (~1 MB per book, skipped with range requests so they are not
// even downloaded); the cover comes from the book itself.
import JSZip from "jszip";
import { createBook, findSameWork, getBookBySourceId } from "../books";
import type { CategoryId } from "../categories";
import { normalizeCover } from "../cover-art";
import { estimatePages, inspectEpub } from "../epub";
import { fetchFile } from "../fetch-file";
import { fetchZipEntries } from "../remote-zip";
import { sniff } from "../magic";
import { scanEpub } from "../scan";
import { deleteObject, newKey, putObject } from "../storage";
import { contentDisposition, fileNameFor } from "../text";
import { describeHindawiBook, readCopyrightPage, readTitlePage, republishable } from "./hindawi-rules";
import type { ImportResult } from "./types";

const DOWNLOADS = "https://downloads.hindawi.org/books";

export interface HindawiEntry {
  /** The number in the book's address, e.g. safahat.org/books/53742042 */
  id: string;
  category: CategoryId;
  title?: string;
  description?: string;
  /** Film adaptation note, e.g. "رحلة إلى مركز الأرض (2008)". */
  film?: string;
  /**
   * Checked by hand: when the copyright page gives no date at all ("في تاريخ غير
   * معروف"), the year of the old edition the text comes from.
   */
  originalYear?: number;
}

export function isHindawiId(value: string): boolean {
  return /^\d{6,10}$/.test(value);
}

export function hindawiBookUrl(id: string): string {
  return `https://www.safahat.org/books/${id}/`;
}

/** Hindawi addresses look like hindawi.org/books/53742042 or safahat.org/books/53742042/. */
export function hindawiIdFrom(input: string): string | null {
  const value = input.trim();
  if (isHindawiId(value)) return value;
  try {
    const url = new URL(value);
    if (!/(^|\.)(hindawi|safahat)\.org$/.test(url.hostname)) return null;
    const id = /\/books\/(\d{6,10})(?:\/|$)/.exec(url.pathname)?.[1];
    return id ?? null;
  } catch {
    return null;
  }
}

function findFile(zip: JSZip, suffix: string): JSZip.JSZipObject | null {
  return zip.file(new RegExp(`(^|/)${suffix.replace(/\./g, "\\.")}$`, "i"))[0] ?? null;
}

const FONT = /\.(ttf|otf|woff2?)$/i;
const baseName = (path: string) => path.split("/").pop()!.toLowerCase();
const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/** Font file names (lower case) that the stylesheets load. */
function fontsUsedBy(styles: string[]): Set<string> {
  return new Set(styles.flatMap((css) => [...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)].map((m) => baseName(m[1]))));
}

/**
 * Downloads the book without the fonts no stylesheet uses. Falls back to the
 * whole file when the server does not do range requests.
 */
async function loadEpub(id: string): Promise<JSZip | null> {
  const url = `${DOWNLOADS}/${id}.epub`;
  const accept = "application/epub+zip";
  const keep = (name: string, styles: string[]) => !FONT.test(name) || fontsUsedBy(styles).has(baseName(name));
  const files = await fetchZipEntries(url, accept, (entry, styles) => keep(entry.name, styles)).catch(() => null);
  if (files) {
    const zip = new JSZip();
    const mimetype = files.get("mimetype");
    if (mimetype) zip.file("mimetype", mimetype);
    for (const [name, data] of files) if (name !== "mimetype") zip.file(name, data);
    return zip;
  }
  const original = await fetchFile(url, 80 * 1024 * 1024, 600_000, accept);
  return JSZip.loadAsync(original).catch(() => null);
}

/** Removes unused fonts (and manifest items for fonts not in the file), then packs a compliant EPUB. */
export async function slimEpub(zip: JSZip): Promise<Uint8Array> {
  const used = fontsUsedBy(await Promise.all(zip.file(/\.css$/i).map((f) => f.async("string"))));
  for (const font of zip.file(FONT)) if (!used.has(baseName(font.name))) zip.remove(font.name);
  const present = new Set(zip.file(FONT).map((f) => baseName(f.name)));
  // Some Hindawi stylesheets point at fonts the book does not contain
  // (EversonMono, SimSun…); epub.js stops on those, so drop such rules.
  const files = new Set(Object.values(zip.files).filter((f) => !f.dir).map((f) => baseName(f.name)));
  const exists = (url: string) => /^(data:|https?:)/i.test(url) || files.has(baseName(url));
  for (const css of zip.file(/\.css$/i)) {
    const text = await css.async("string");
    const fixed = text
      .replace(/@font-face\s*\{[^}]*\}/gi, (block) =>
        [...block.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)].every((m) => exists(m[1])) ? block : "",
      )
      .replace(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi, (match, url: string) => (exists(url) ? match : "none"));
    if (fixed !== text) zip.file(css.name, fixed);
  }
  // The manifest must only list files the book contains (Hindawi's sometimes
  // lists fonts it never shipped, and epub.js fails on them).
  const opfFile = zip.file(/\.opf$/i)[0];
  if (opfFile) {
    const opf = await opfFile.async("string");
    const spine = new Set([...opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/gi)].map((m) => m[1]));
    const cleaned = opf.replace(/<item\b[^>]*>\s*/gi, (tag) => {
      const href = /href="([^"]+)"/i.exec(tag)?.[1] ?? "";
      const id = /\bid="([^"]+)"/i.exec(tag)?.[1] ?? "";
      const missing = FONT.test(href) ? !present.has(baseName(href)) : !files.has(baseName(safeDecode(href)));
      return missing && !spine.has(id) ? "" : tag;
    });
    if (cleaned !== opf) zip.file(opfFile.name, cleaned);
  }
  // The mimetype entry must stay first and uncompressed.
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 9 } });
}

async function coverOf(zip: JSZip): Promise<Uint8Array | null> {
  const opf = await zip.file(/\.opf$/i)[0]?.async("string");
  let href: string | undefined;
  if (opf) {
    const id = /<meta\s+name="cover"\s+content="([^"]+)"/i.exec(opf)?.[1];
    const item =
      [...opf.matchAll(/<item\b[^>]*>/gi)].map((m) => m[0]).find((tag) => /properties="[^"]*cover-image/.test(tag)) ??
      (id ? [...opf.matchAll(/<item\b[^>]*>/gi)].map((m) => m[0]).find((tag) => tag.includes(`id="${id}"`)) : undefined);
    href = item ? /href="([^"]+)"/.exec(item)?.[1] : undefined;
  }
  const file = href ? findFile(zip, href.split("/").pop()!) : findFile(zip, "cover.jpg");
  if (!file) return null;
  const image = await file.async("uint8array");
  const kind = sniff(image.subarray(0, 64));
  if (kind !== "jpeg" && kind !== "png" && kind !== "webp") return null;
  return normalizeCover(image).catch(() => null);
}

export async function importHindawiBook(entry: HindawiEntry): Promise<ImportResult> {
  if (!isHindawiId(entry.id)) return { status: "skipped", reason: "رقم كتاب غير صالح" };
  const sourceId = `hindawi:${entry.id}`;
  const existing = await getBookBySourceId(sourceId);
  if (existing) return { status: "exists", book: existing };

  const zip = await loadEpub(entry.id);
  // Hindawi compresses the "mimetype" entry (the spec says to store it), so check
  // its content instead of its raw bytes; the rebuilt file below is compliant.
  const mimetype = await zip?.file("mimetype")?.async("string");
  if (!zip || mimetype?.trim() !== "application/epub+zip") return { status: "skipped", reason: "ملف EPUB غير صالح" };

  const copyrightFile = findFile(zip, "copyright.xhtml");
  if (!copyrightFile) return { status: "skipped", reason: "لا توجد صفحة حقوق في الكتاب" };
  const copyright = readCopyrightPage(await copyrightFile.async("string"));
  if (copyright.originalYear === null && !copyright.originalCentury && entry.originalYear) copyright.originalYear = entry.originalYear;
  const refusal = republishable(copyright);
  if (refusal) return { status: "skipped", reason: refusal };

  const titlePageFile = findFile(zip, "fp2.xhtml") ?? findFile(zip, "fp1.xhtml");
  const titlePage = titlePageFile ? readTitlePage(await titlePageFile.async("string")) : { author: "", translator: "" };
  const title = entry.title?.trim() || copyright.title;
  const author = titlePage.author || copyright.author;
  if (!title) return { status: "skipped", reason: "تعذّر قراءة عنوان الكتاب" };
  const sameWork = await findSameWork("ar", title, author);
  if (sameWork) return { status: "exists", book: sameWork };

  const cover = await coverOf(zip);
  const epub = await slimEpub(zip);
  if (sniff(epub.subarray(0, 1024)) !== "epub") return { status: "skipped", reason: "تعذّر إعادة بناء ملف EPUB" };
  const threat = await scanEpub(epub).catch(() => "ملف تالف");
  if (threat) return { status: "skipped", reason: `محتوى نشط: ${threat}` };
  const info = await inspectEpub(epub);
  if (info.textLength < 3000) return { status: "skipped", reason: "النص قصير جداً" };

  let epubKey: string | null = null;
  let coverKey: string | null = null;
  try {
    epubKey = newKey("epub");
    await putObject(epubKey, epub, {
      contentType: "application/epub+zip",
      disposition: contentDisposition(fileNameFor(title, author, "epub")),
    });
    if (cover) {
      coverKey = newKey("cover", "jpg");
      await putObject(coverKey, cover, { contentType: "image/jpeg" });
    }
    const credit = titlePage.translator ? ` ترجمة: ${titlePage.translator}.` : "";
    const book = await createBook({
      lang: "ar",
      title,
      author,
      description: entry.description?.trim() ? `${entry.description.trim()}${credit}` : describeHindawiBook(copyright, titlePage),
      category: entry.category,
      year: copyright.originalYear ? String(copyright.originalYear) : "",
      coverKey,
      pdfKey: null,
      pdfSize: null,
      epubKey,
      epubSize: epub.byteLength,
      pages: estimatePages(info.textLength, "ar"),
      pagesApprox: true,
      source: "مؤسسة هنداوي",
      sourceId,
      sourceUrl: hindawiBookUrl(entry.id),
      license: "cc-by",
      film: entry.film?.trim() ?? "",
      complete: true,
      // Hand-described and filmed books first in "most read" until readers decide.
      popularity: (entry.film ? 20 : 0) + (entry.description ? 10 : 0),
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
