"use server";

import { audit, clientIp } from "../auth";
import { UNKNOWN_IP } from "../ip";
import { getBook } from "../books";
import { rateLimit } from "../rate-limit";
import { createReport, isReportReason } from "../reports";

export type ReportState = { ok: true } | { ok: false; error: string } | null;

export async function submitReport(_prev: ReportState, form: FormData): Promise<ReportState> {
  // Bots fill every field; people never see this one.
  if (String(form.get("website") ?? "") !== "") return { ok: true };

  const bookId = Number(form.get("bookId"));
  const reason = form.get("reason");
  const details = String(form.get("details") ?? "").trim().slice(0, 2000);
  const contact = String(form.get("contact") ?? "").trim().slice(0, 200);

  if (!isReportReason(reason)) return { ok: false, error: "اختر سبب البلاغ." };
  if (reason === "copyright" && details.length < 10) {
    return { ok: false, error: "اشرح باختصار من يملك الحقوق وكيف نتواصل معه أو معك." };
  }
  const book = Number.isSafeInteger(bookId) ? await getBook(bookId, { includeUnpublished: true }) : null;
  if (!book) return { ok: false, error: "لم نجد هذا الكتاب." };
  // Without a trusted client IP every visitor shares one bucket, so allow more.
  const ip = await clientIp();
  if (!rateLimit(`report:${ip}`, ip === UNKNOWN_IP ? 30 : 6, 60 * 60 * 1000)) {
    return { ok: false, error: "أرسلت بلاغات كثيرة خلال وقت قصير. حاول بعد قليل." };
  }
  await createReport({ bookId, reason, details, contact });
  await audit("report", `#${bookId} ${reason}`, ip);
  return { ok: true };
}
