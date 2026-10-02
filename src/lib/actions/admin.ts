"use server";

// Every action re-checks the admin session itself: server actions are public
// endpoints, and arguments are validated at runtime for the same reason.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit, endAllSessions, endSession, isAdmin, startSession } from "../auth";
import { createBook, deleteBook, getBook, updateBook, type BookInput } from "../books";
import { LICENSES, isCategory, isLang } from "../categories";
import { fetchGutendexBook, importGutenbergBatch, importGutenbergBook } from "../import/gutenberg";
import { isGutenbergTopic } from "../import/gutenberg-topics";
import type { ImportResult } from "../import/types";
import { hindawiIdFrom, importHindawiBook } from "../import/hindawi";
import { hindawiPick } from "../import/hindawi-picks";
import { importWikisourceBook, starterEntry } from "../import/wikisource";
import { sniff, type FileKind } from "../magic";
import { bookPath } from "../paths";
import { deleteReport, setReportStatus } from "../reports";
import { PdfScanner, scanEpub } from "../scan";
import { MAX_BOOK_BYTES, MAX_COVER_BYTES, deleteObject, isValidKey, objectSize, openObject, readHead } from "../storage";
import { safeExternalUrl } from "../url";

async function assertAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("غير مصرّح");
}

function refreshSite() {
  revalidatePath("/", "layout");
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : "خطأ غير متوقع";
}

// ——— Session ———

export type LoginState = { error: string } | null;

export async function loginAction(_prev: LoginState, form: FormData): Promise<LoginState> {
  const password = String(form.get("password") ?? "").slice(0, 200);
  const result = await startSession(password);
  if (result === "ok") redirect("/admin");
  if (result === "locked") return { error: "محاولات كثيرة. انتظر ربع ساعة ثم حاول مجدداً." };
  if (result === "unconfigured") return { error: "لوحة التحكم غير مفعّلة: اضبط ADMIN_PASSWORD وSESSION_SECRET في متغيرات البيئة." };
  return { error: "كلمة السر غير صحيحة." };
}

/** Signs out every admin session (e.g. after a suspected leak). */
export async function logoutEverywhereAction(): Promise<void> {
  await assertAdmin();
  await endAllSessions();
  redirect("/admin/login");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/admin/login");
}

// ——— Books ———

type FileSlot = "pdf" | "epub" | "cover";

export interface BookPayload {
  id?: number;
  lang: string;
  title: string;
  author: string;
  description: string;
  category: string;
  year: string;
  source: string;
  sourceUrl: string;
  license: string;
  film?: string;
  complete?: boolean;
  published: boolean;
  pages: number | null;
  /** undefined = keep current file, null = remove it, { key } = newly uploaded. */
  pdf?: { key: string } | null;
  epub?: { key: string } | null;
  cover?: { key: string } | null;
}

export type SaveResult = { ok: true; id: number; href: string } | { ok: false; error: string };

const SLOT_RULES: Record<FileSlot, { prefix: string; kinds: FileKind[]; max: number; error: string }> = {
  pdf: { prefix: "books/", kinds: ["pdf"], max: MAX_BOOK_BYTES, error: "الملف المرفوع ليس PDF صالحاً" },
  epub: { prefix: "books/", kinds: ["epub"], max: MAX_BOOK_BYTES, error: "الملف المرفوع ليس EPUB صالحاً" },
  cover: { prefix: "covers/", kinds: ["jpeg", "png", "webp"], max: MAX_COVER_BYTES, error: "الغلاف ليس صورة صالحة" },
};

const EXT_FOR_KIND: Record<FileKind, string> = { pdf: ".pdf", epub: ".epub", jpeg: ".jpg", png: ".png", webp: ".webp" };

/** Checks an uploaded object by its real bytes; deletes it if it is not what it claims. */
async function verifyUpload(slot: FileSlot, value: unknown): Promise<{ key: string; size: number } | string> {
  const key = (value as { key?: unknown })?.key;
  const rule = SLOT_RULES[slot];
  if (!isValidKey(key) || !key.startsWith(rule.prefix)) return "مرجع ملف غير صالح";
  const size = await objectSize(key);
  if (size == null) return "لم يكتمل رفع الملف، حاول مرة أخرى";
  const head = await readHead(key, 1024);
  const kind = head ? sniff(head) : null;
  if (size > rule.max || !kind || !rule.kinds.includes(kind) || !key.endsWith(EXT_FOR_KIND[kind])) {
    await deleteObject(key);
    await audit("upload_rejected", `${slot}: wrong type or size`);
    return size > rule.max ? "الملف أكبر من الحد المسموح" : rule.error;
  }
  const threat = slot === "cover" ? null : await scanStored(slot, key, size);
  if (threat) {
    await deleteObject(key);
    await audit("upload_rejected", `${slot}: ${threat}`);
    return `رفضنا الملف لأنه يحتوي على محتوى نشط (${threat})، حمايةً لمن يحمّله.`;
  }
  return { key, size };
}

const MAX_EPUB_SCAN_BYTES = 150 * 1024 * 1024;

/** Reads an uploaded book back from storage and looks for active content. */
async function scanStored(slot: "pdf" | "epub", key: string, size: number): Promise<string | null> {
  if (slot === "epub" && size > MAX_EPUB_SCAN_BYTES) return "ملف EPUB أكبر من 150 ميغابايت";
  const stream = await openObject(key);
  if (!stream) return "تعذّر قراءة الملف للفحص";
  const reader = stream.getReader();
  if (slot === "pdf") {
    const scanner = new PdfScanner();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return scanner.finish();
      const found = scanner.push(value);
      if (found) {
        await reader.cancel();
        return `/${found}`;
      }
    }
  }
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  try {
    return await scanEpub(Buffer.concat(chunks));
  } catch {
    return "ملف EPUB تالف";
  }
}

function text(value: unknown, max: number, multiline = false): string {
  if (typeof value !== "string") return "";
  const cleaned = multiline
    ? value.replace(/\r\n/g, "\n").replace(/[^\S\n]+/g, " ").replace(/\n{3,}/g, "\n\n")
    : value.replace(/\s+/g, " ");
  return cleaned.trim().slice(0, max);
}

export async function saveBookAction(payload: BookPayload): Promise<SaveResult> {
  await assertAdmin();
  const fail = (error: string): SaveResult => ({ ok: false, error });

  const lang = payload?.lang;
  if (!isLang(lang)) return fail("اختر لغة الكتاب.");
  const title = text(payload.title, 300);
  if (!title) return fail("عنوان الكتاب مطلوب.");
  const category = payload.category;
  if (!isCategory(category)) return fail("اختر التصنيف.");
  const license = LICENSES.find((l) => l.id === payload.license)?.id;
  if (!license) return fail("اختر رخصة الكتاب.");
  const rawUrl = text(payload.sourceUrl, 500);
  const sourceUrl = rawUrl ? safeExternalUrl(rawUrl) : "";
  if (sourceUrl === null) return fail("رابط المصدر يجب أن يبدأ بـ https://");
  const pages =
    typeof payload.pages === "number" && Number.isSafeInteger(payload.pages) && payload.pages > 0 && payload.pages < 100_000
      ? payload.pages
      : null;

  const existing = payload.id != null ? await getBook(Number(payload.id), { includeUnpublished: true }) : null;
  if (payload.id != null && !existing) return fail("الكتاب غير موجود.");

  const uploaded: Partial<Record<FileSlot, { key: string; size: number }>> = {};
  const discardUploads = () => Promise.all(Object.values(uploaded).map((f) => deleteObject(f?.key)));
  for (const slot of ["pdf", "epub", "cover"] as const) {
    if (!payload[slot]) continue;
    const result = await verifyUpload(slot, payload[slot]);
    if (typeof result === "string") {
      await discardUploads();
      return fail(result);
    }
    uploaded[slot] = result;
  }

  const pick = (slot: FileSlot, current: string | null | undefined, currentSize: number | null | undefined) =>
    uploaded[slot]
      ? { key: uploaded[slot].key, size: uploaded[slot].size }
      : payload[slot] === null
        ? { key: null, size: null }
        : { key: current ?? null, size: currentSize ?? null };
  const pdf = pick("pdf", existing?.pdfKey, existing?.pdfSize);
  const epub = pick("epub", existing?.epubKey, existing?.epubSize);
  const cover = pick("cover", existing?.coverKey, null);
  if (!pdf.key && !epub.key) {
    await discardUploads();
    return fail("أضف ملف PDF أو EPUB واحداً على الأقل.");
  }

  const input: BookInput = {
    lang,
    title,
    author: text(payload.author, 200),
    description: text(payload.description, 6000, true),
    category,
    year: text(payload.year, 20),
    coverKey: cover.key,
    pdfKey: pdf.key,
    pdfSize: pdf.size,
    epubKey: epub.key,
    epubSize: epub.size,
    pages: pages ?? existing?.pages ?? null,
    pagesApprox: pages != null ? false : (existing?.pagesApprox ?? false),
    source: text(payload.source, 100),
    sourceId: existing?.sourceId ?? null,
    sourceUrl,
    license,
    film: text(payload.film, 200),
    complete: payload.complete === true,
    popularity: existing?.popularity ?? 0,
    published: payload.published === true,
  };

  let saved;
  try {
    saved = existing ? await updateBook(existing.id, input) : await createBook(input);
  } catch (err) {
    await discardUploads();
    console.error("[admin] save failed:", err);
    return fail("تعذّر حفظ الكتاب.");
  }
  if (!saved) return fail("تعذّر حفظ الكتاب.");

  if (existing) {
    for (const [old, current] of [
      [existing.pdfKey, pdf.key],
      [existing.epubKey, epub.key],
      [existing.coverKey, cover.key],
    ] as const) {
      if (old && old !== current) await deleteObject(old);
    }
  }
  await audit(existing ? "book_updated" : "book_created", `#${saved.id} ${saved.title}`);
  refreshSite();
  return { ok: true, id: saved.id, href: bookPath(saved) };
}

export async function deleteBookAction(id: number): Promise<{ ok: boolean }> {
  await assertAdmin();
  const book = await deleteBook(Number(id));
  if (book) {
    await Promise.all([deleteObject(book.pdfKey), deleteObject(book.epubKey), deleteObject(book.coverKey)]);
    await audit("book_deleted", `#${book.id} ${book.title}`);
    refreshSite();
  }
  return { ok: Boolean(book) };
}

export async function setPublishedAction(id: number, published: boolean): Promise<void> {
  await assertAdmin();
  await updateBook(Number(id), { published: published === true });
  await audit(published === true ? "book_published" : "book_hidden", `#${Number(id)}`);
  refreshSite();
}

// ——— Imports ———

export type ImportActionResult =
  | { ok: true; status: "imported" | "exists" | "skipped"; title: string; id?: number; reason?: string }
  | { ok: false; error: string };

function summarize(result: ImportResult, fallbackTitle: string): ImportActionResult {
  if (result.status === "skipped") return { ok: true, status: "skipped", title: fallbackTitle, reason: result.reason };
  return { ok: true, status: result.status, title: result.book.title, id: result.book.id };
}

export async function importGutenbergBatchAction(page: number, limit: number, topic: string = "") {
  await assertAdmin();
  const safePage = Math.min(1000, Math.max(1, Math.floor(Number(page)) || 1));
  const safeLimit = Math.min(5, Math.max(1, Math.floor(Number(limit)) || 1));
  if (!isGutenbergTopic(topic)) return { ok: false as const, error: "نوع غير معروف." };
  try {
    const result = await importGutenbergBatch("en", safePage, safeLimit, topic);
    if (result.imported.length) {
      await audit("import", `gutenberg: ${result.imported.length} book(s)`);
      refreshSite();
    }
    return { ok: true as const, ...result };
  } catch (err) {
    return { ok: false as const, error: `تعذّر الاتصال بـ Gutenberg: ${errorText(err)}` };
  }
}

export async function importGutenbergByIdAction(gutenbergId: number): Promise<ImportActionResult> {
  await assertAdmin();
  const id = Math.floor(Number(gutenbergId));
  if (!Number.isSafeInteger(id) || id < 1) return { ok: false, error: "رقم الكتاب غير صالح." };
  try {
    const result = await importGutenbergBook(await fetchGutendexBook(id));
    if (result.status === "imported") {
      await audit("import", result.book.title);
      refreshSite();
    }
    return summarize(result, `#${id}`);
  } catch (err) {
    return { ok: false, error: `تعذّر الاستيراد: ${errorText(err)}` };
  }
}

export async function importWikisourceAction(entry: {
  page: string;
  category: string;
  title?: string;
  author?: string;
  description?: string;
}): Promise<ImportActionResult> {
  await assertAdmin();
  const page = text(entry?.page, 200);
  if (!page) return { ok: false, error: "اكتب اسم الصفحة في ويكي مصدر." };
  if (!isCategory(entry.category)) return { ok: false, error: "اختر التصنيف." };
  try {
    const result = await importWikisourceBook({
      page,
      category: entry.category,
      title: text(entry.title, 300) || undefined,
      author: text(entry.author, 200) || undefined,
      description: text(entry.description, 6000, true) || undefined,
    });
    if (result.status === "imported") {
      await audit("import", result.book.title);
      refreshSite();
    }
    return summarize(result, page);
  } catch (err) {
    return { ok: false, error: `تعذّر الاستيراد: ${errorText(err)}` };
  }
}

export async function importStarterAction(page: string): Promise<ImportActionResult> {
  await assertAdmin();
  const entry = starterEntry(String(page));
  if (!entry) return { ok: false, error: "هذا الكتاب ليس في القائمة المقترحة." };
  try {
    const result = await importWikisourceBook(entry);
    if (result.status === "imported") {
      await audit("import", result.book.title);
      refreshSite();
    }
    return summarize(result, entry.title ?? entry.page);
  } catch (err) {
    return { ok: false, error: `تعذّر الاستيراد: ${errorText(err)}` };
  }
}

export async function importHindawiPickAction(id: string): Promise<ImportActionResult> {
  await assertAdmin();
  const entry = hindawiPick(String(id));
  if (!entry) return { ok: false, error: "هذا الكتاب ليس في القائمة المقترحة." };
  try {
    const result = await importHindawiBook(entry);
    if (result.status === "imported") {
      await audit("import", result.book.title);
      refreshSite();
    }
    return summarize(result, entry.title ?? `#${entry.id}`);
  } catch (err) {
    return { ok: false, error: `تعذّر الاستيراد: ${errorText(err)}` };
  }
}

export async function importHindawiAction(input: { address: string; category: string; film?: string }): Promise<ImportActionResult> {
  await assertAdmin();
  const id = hindawiIdFrom(text(input?.address, 300));
  if (!id) return { ok: false, error: "الصق رابط الكتاب من موقع هنداوي (مثل safahat.org/books/53742042) أو رقمه." };
  if (!isCategory(input.category)) return { ok: false, error: "اختر التصنيف." };
  try {
    const result = await importHindawiBook({ ...(hindawiPick(id) ?? {}), id, category: input.category, film: text(input.film, 200) || hindawiPick(id)?.film });
    if (result.status === "imported") {
      await audit("import", result.book.title);
      refreshSite();
    }
    return summarize(result, `#${id}`);
  } catch (err) {
    return { ok: false, error: `تعذّر الاستيراد: ${errorText(err)}` };
  }
}

// ——— Reports ———

export async function resolveReportAction(id: number, status: "open" | "resolved"): Promise<void> {
  await assertAdmin();
  await setReportStatus(Number(id), status === "resolved" ? "resolved" : "open");
  revalidatePath("/admin", "layout");
}

export async function deleteReportAction(id: number): Promise<void> {
  await assertAdmin();
  await deleteReport(Number(id));
  revalidatePath("/admin", "layout");
}
