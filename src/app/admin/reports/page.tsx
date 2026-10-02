import type { Metadata } from "next";
import Link from "next/link";
import { deleteReportAction, resolveReportAction, setPublishedAction } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth";
import { listReports, reasonLabel } from "@/lib/reports";
import { cn } from "@/lib/site";

export const metadata: Metadata = { title: "البلاغات" };

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await requireAdmin();
  const status = (await searchParams).status === "resolved" ? "resolved" : "open";
  const reports = await listReports(status);
  const dateFormat = new Intl.DateTimeFormat("ar-IQ", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div>
      <h1 className="text-2xl font-bold">البلاغات</h1>
      <div className="mt-4 flex gap-2 text-sm">
        {(["open", "resolved"] as const).map((s) => (
          <Link
            key={s}
            href={s === "open" ? "/admin/reports" : "/admin/reports?status=resolved"}
            className={cn("chip", status === s && "chip-active")}
          >
            {s === "open" ? "مفتوحة" : "محلولة"}
          </Link>
        ))}
      </div>

      {reports.length === 0 ? (
        <p className="card mt-6 p-6 text-center text-sm text-muted">لا توجد بلاغات هنا.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {reports.map((report) => (
            <li key={report.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={cn("text-sm font-semibold", report.reason === "copyright" && "text-red-600 dark:text-red-400")}>
                    {reasonLabel(report.reason)}
                  </p>
                  {report.bookId && report.bookTitle ? (
                    <Link href={`/admin/books/${report.bookId}`} className="mt-1 block truncate text-sm hover:text-accent" dir="auto">
                      {report.bookTitle}
                      {report.bookPublished === false && <span className="text-muted"> (مخفي)</span>}
                    </Link>
                  ) : (
                    <p className="mt-1 text-sm text-muted">الكتاب محذوف</p>
                  )}
                </div>
                <time className="shrink-0 text-xs text-muted" dateTime={report.createdAt.toISOString()}>
                  {dateFormat.format(report.createdAt)}
                </time>
              </div>
              {report.details && (
                <p className="mt-3 whitespace-pre-line rounded-xl bg-surface-2 p-3 text-sm leading-7" dir="auto">
                  {report.details}
                </p>
              )}
              {report.contact && (
                <p className="mt-2 text-sm text-muted">
                  للتواصل: <span dir="auto" className="select-all text-ink">{report.contact}</span>
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {report.bookId && report.bookPublished && (
                  <form action={setPublishedAction.bind(null, report.bookId, false)}>
                    <button type="submit" className="btn-danger text-xs">إخفاء الكتاب</button>
                  </form>
                )}
                <form action={resolveReportAction.bind(null, report.id, status === "open" ? "resolved" : "open")}>
                  <button type="submit" className="btn-secondary text-xs">
                    {status === "open" ? "تم الحل" : "إعادة فتح"}
                  </button>
                </form>
                <form action={deleteReportAction.bind(null, report.id)}>
                  <button type="submit" className="btn-ghost text-xs text-muted">حذف البلاغ</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
