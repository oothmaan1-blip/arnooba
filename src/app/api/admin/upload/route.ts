// Receives a file upload when storage is local (no bucket configured).
import { isAdmin, uploadTokenValid } from "@/lib/auth";
import { isSameOrigin, json } from "@/lib/request";
import {
  MAX_BOOK_BYTES,
  MAX_COVER_BYTES,
  UploadTooLargeError,
  isValidKey,
  storageMode,
  writeLocalUpload,
} from "@/lib/storage";

export async function PUT(req: Request) {
  if (storageMode() !== "local") return json({ error: "not found" }, 404);
  if (!(await isAdmin())) return json({ error: "غير مصرّح" }, 401);
  if (!isSameOrigin(req)) return json({ error: "طلب مرفوض" }, 403);

  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!isValidKey(key) || !uploadTokenValid(key, url.searchParams.get("token"))) {
    return json({ error: "رابط الرفع غير صالح أو منتهي" }, 403);
  }
  if (!req.body) return json({ error: "الملف فارغ" }, 400);

  const limit = key.startsWith("covers/") ? MAX_COVER_BYTES : MAX_BOOK_BYTES;
  try {
    const size = await writeLocalUpload(key, req.body, limit);
    return json({ key, size }, 201);
  } catch (err) {
    if (err instanceof UploadTooLargeError) return json({ error: "الملف أكبر من الحد المسموح" }, 413);
    console.error("[upload] failed:", err);
    return json({ error: "تعذّر حفظ الملف" }, 500);
  }
}
