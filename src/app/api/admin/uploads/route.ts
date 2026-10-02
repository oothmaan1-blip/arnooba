// Hands the admin's browser upload targets for new book files. The files are
// verified by content (not by name or declared type) when the book is saved.
import { isAdmin } from "@/lib/auth";
import { isSameOrigin, json } from "@/lib/request";
import { MAX_BOOK_BYTES, MAX_COVER_BYTES, createUploadTarget, newKey, type ObjectKind } from "@/lib/storage";
import { contentDisposition, fileNameFor } from "@/lib/text";

const COVER_TYPES: Record<string, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

interface RequestedFile {
  kind: ObjectKind;
  size: number;
  type: string;
}

function isRequestedFile(value: unknown): value is RequestedFile {
  const f = value as RequestedFile;
  return (
    !!f &&
    (f.kind === "pdf" || f.kind === "epub" || f.kind === "cover") &&
    Number.isSafeInteger(f.size) &&
    f.size > 0 &&
    typeof f.type === "string"
  );
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return json({ error: "غير مصرّح" }, 401);
  if (!isSameOrigin(req)) return json({ error: "طلب مرفوض" }, 403);

  const body = (await req.json().catch(() => null)) as { files?: unknown; title?: unknown; author?: unknown } | null;
  const files = Array.isArray(body?.files) ? body.files : [];
  if (files.length === 0 || files.length > 3 || !files.every(isRequestedFile)) {
    return json({ error: "طلب رفع غير صالح" }, 400);
  }
  const title = typeof body?.title === "string" ? body.title.slice(0, 300) : "book";
  const author = typeof body?.author === "string" ? body.author.slice(0, 200) : "";

  const targets = [];
  for (const file of files) {
    if (file.kind === "cover") {
      const ext = COVER_TYPES[file.type];
      if (!ext) return json({ error: "صيغة الغلاف يجب أن تكون JPG أو PNG أو WebP" }, 400);
      if (file.size > MAX_COVER_BYTES) return json({ error: "صورة الغلاف أكبر من 8 ميغابايت" }, 400);
      targets.push({ kind: file.kind, ...(await createUploadTarget(newKey("cover", ext), file.type)) });
    } else {
      if (file.size > MAX_BOOK_BYTES) return json({ error: "الملف أكبر من 300 ميغابايت" }, 400);
      const type = file.kind === "pdf" ? "application/pdf" : "application/epub+zip";
      const disposition = contentDisposition(fileNameFor(title, author, file.kind));
      targets.push({ kind: file.kind, ...(await createUploadTarget(newKey(file.kind), type, disposition)) });
    }
  }
  return json({ targets });
}
