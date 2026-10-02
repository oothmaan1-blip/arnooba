"use client";

import { useActionState } from "react";
import { CircleCheck } from "lucide-react";
import { submitReport, type ReportState } from "@/lib/actions/report";
import { REPORT_REASONS } from "@/lib/reports-shared";

export function ReportForm({ bookId }: { bookId: number }) {
  const [state, action, pending] = useActionState<ReportState, FormData>(submitReport, null);

  if (state?.ok) {
    return (
      <div className="card flex items-start gap-3 p-5" role="status">
        <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
        <div>
          <p className="font-semibold">وصلنا بلاغك، شكراً لك.</p>
          <p className="mt-1 text-sm text-muted">نراجع البلاغات يدوياً، وبلاغات حقوق النشر لها الأولوية.</p>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="card space-y-5 p-5">
      <input type="hidden" name="bookId" value={bookId} />
      <div aria-hidden="true" className="hidden">
        <label>
          الموقع
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <fieldset>
        <legend className="label">سبب البلاغ</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {REPORT_REASONS.map((r) => (
            <label key={r.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
              <input type="radio" name="reason" value={r.id} required className="accent-[var(--accent)]" />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="details" className="label">
          التفاصيل
        </label>
        <textarea id="details" name="details" rows={5} maxLength={2000} className="input leading-7" placeholder="ما المشكلة بالضبط؟ لبلاغات حقوق النشر: من يملك الحقوق؟" />
      </div>

      <div>
        <label htmlFor="contact" className="label">
          وسيلة للتواصل معك <span className="font-normal text-muted">(اختياري)</span>
        </label>
        <input id="contact" name="contact" maxLength={200} className="input" dir="auto" placeholder="name@example.com" />
      </div>

      {state && !state.ok && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? "جارٍ الإرسال…" : "إرسال البلاغ"}
      </button>
    </form>
  );
}
