"use client";

// Browser-side helpers for the admin book form: read metadata and a cover
// straight from the chosen PDF/EPUB, and upload files with progress.

const PDF_ASSETS = "/pdfjs/";

function cleanMeta(value: unknown): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  // Metadata like "Microsoft Word - draft.docx" is worse than nothing.
  return /\.(docx?|pdf|indd|odt|rtf)$|^untitled$|^microsoft word/i.test(text) ? "" : text.slice(0, 300);
}

function stripHtml(value: unknown): string {
  if (typeof value !== "string") return "";
  const doc = new DOMParser().parseFromString(value, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 6000);
}

export async function toJpeg(image: Blob, maxWidth = 800): Promise<Blob> {
  const bitmap = await createImageBitmap(image);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("لا يدعم المتصفح معالجة الصور");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("تعذّر تجهيز صورة الغلاف"))), "image/jpeg", 0.86),
  );
}

/** A file we refuse to publish; its message is shown to the admin as is. */
export class ActiveContentError extends Error {}

export interface FileInsights {
  pages?: number;
  title?: string;
  author?: string;
  description?: string;
  language?: string;
  cover?: Blob | null;
}

export async function inspectPdf(file: File): Promise<FileInsights> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `${PDF_ASSETS}pdf.worker.min.mjs`;
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    cMapUrl: `${PDF_ASSETS}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${PDF_ASSETS}standard_fonts/`,
    wasmUrl: `${PDF_ASSETS}wasm/`,
    iccUrl: `${PDF_ASSETS}iccs/`,
  }).promise;
  try {
    // Books have no business running code or carrying hidden files; the server
    // checks again, this just explains the problem before the upload.
    const [jsActions, attachments, firstPage] = await Promise.all([
      doc.getJSActions().catch(() => null),
      doc.getAttachments().catch(() => null),
      doc.getPage(1),
    ]);
    const pageActions = await firstPage.getJSActions().catch(() => null);
    const hasEntries = (m: unknown) => (m instanceof Map ? m.size > 0 : !!m && Object.keys(m as object).length > 0);
    if (hasEntries(jsActions) || hasEntries(pageActions) || hasEntries(attachments)) {
      throw new ActiveContentError("ملف PDF يحتوي على سكربتات أو ملفات مرفقة مخفية، ولا ننشر ملفات كهذه حمايةً للقرّاء.");
    }
    const meta = await doc.getMetadata().catch(() => null);
    const info = (meta?.info ?? {}) as { Title?: unknown; Author?: unknown };
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 800 / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvas, viewport }).promise;
    const cover = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
    return { pages: doc.numPages, title: cleanMeta(info.Title), author: cleanMeta(info.Author), cover };
  } finally {
    await doc.loadingTask.destroy();
  }
}

export async function inspectEpub(file: File): Promise<FileInsights> {
  const { default: ePub } = await import("epubjs");
  const book = ePub(await file.arrayBuffer());
  try {
    const meta = (await book.loaded.metadata) as unknown as Record<string, unknown>;
    let cover: Blob | null = null;
    const coverUrl = await book.coverUrl().catch(() => null);
    if (coverUrl) cover = await toJpeg(await (await fetch(coverUrl)).blob()).catch(() => null);
    return {
      title: cleanMeta(meta.title),
      author: cleanMeta(meta.creator),
      description: stripHtml(meta.description),
      language: typeof meta.language === "string" ? meta.language : undefined,
      cover,
    };
  } finally {
    book.destroy();
  }
}

export type Slot = "pdf" | "epub" | "cover";

export const SLOT_TYPES: Record<Slot, string> = {
  pdf: "application/pdf",
  epub: "application/epub+zip",
  cover: "image/jpeg",
};

interface Target {
  kind: Slot;
  key: string;
  url: string;
  headers: Record<string, string>;
}

function put(target: Target, body: Blob, onProgress: (ratio: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", target.url);
    for (const [name, value] of Object.entries(target.headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = `فشل رفع الملف (${xhr.status})`;
      try {
        message = (JSON.parse(xhr.responseText) as { error?: string }).error ?? message;
      } catch {
        // not JSON (e.g. a bucket error page)
      }
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("انقطع الاتصال أثناء الرفع. تأكد من إعداد CORS للتخزين السحابي."));
    xhr.send(body);
  });
}

export async function uploadFiles(
  files: { slot: Slot; blob: Blob }[],
  meta: { title: string; author: string },
  onProgress: (slot: Slot, ratio: number) => void,
): Promise<Partial<Record<Slot, string>>> {
  const res = await fetch("/api/admin/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...meta,
      files: files.map((f) => ({ kind: f.slot, size: f.blob.size, type: SLOT_TYPES[f.slot] })),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { targets?: Target[]; error?: string };
  if (!res.ok || !data.targets) throw new Error(data.error ?? "تعذّر بدء الرفع");

  const keys: Partial<Record<Slot, string>> = {};
  for (const file of files) {
    const target = data.targets.find((t) => t.kind === file.slot);
    if (!target) throw new Error("تعذّر بدء الرفع");
    await put(target, file.blob, (ratio) => onProgress(file.slot, ratio));
    keys[file.slot] = target.key;
  }
  return keys;
}
