import Link from "next/link";
import { BookPlus, Flag, Import, ShieldCheck } from "lucide-react";
import { logoutEverywhereAction } from "@/lib/actions/admin";
import { requireAdmin, securityOverview } from "@/lib/auth";
import { adminStats, listBooks } from "@/lib/books";
import { LANGS } from "@/lib/categories";
import { countOpenReports } from "@/lib/reports";
import { storageMode } from "@/lib/storage";
import { formatNumber } from "@/lib/text";

const EVENT_LABELS: Record<string, string> = {
  login_ok: "دخول ناجح",
  login_failed: "كلمة سر خاطئة",
  login_locked: "حظر مؤقت لكثرة المحاولات",
  login_blocked_ip: "محاولة دخول من عنوان غير مسموح",
  logout: "تسجيل خروج",
  logout_all: "خروج من كل الأجهزة",
  upload_rejected: "رفض ملف مرفوع",
  book_created: "إضافة كتاب",
  book_updated: "تعديل كتاب",
  book_deleted: "حذف كتاب",
  book_hidden: "إخفاء كتاب",
  book_published: "نشر كتاب",
  import: "استيراد",
  report: "بلاغ جديد",
};

export default async function AdminHome() {
  await requireAdmin();
  const [stats, openReports, latest, security] = await Promise.all([
    adminStats(),
    countOpenReports(),
    listBooks({ sort: "latest", pageSize: 8, includeUnpublished: true }),
    securityOverview(),
  ]);
  const timeFormat = new Intl.DateTimeFormat("ar-IQ", { dateStyle: "short", timeStyle: "short" });
  const cards = [
    ["كتب عربية", stats.ar],
    ["كتب إنكليزية", stats.en],
    ["مرات التحميل", stats.downloads],
    ["مرات القراءة", stats.reads],
  ] as const;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">أهلاً بك</h1>
        <p className="mt-1 text-sm text-muted">
          {stats.hidden > 0 ? `${stats.hidden} كتاب مخفي عن الزوار. ` : ""}
          التخزين: {storageMode() === "s3" ? "سحابي (S3/R2)" : "محلي على القرص (مجلد storage)"}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="card p-5">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-1 text-3xl font-bold">{formatNumber(value)}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/admin/books/new" className="card flex items-center gap-3 p-5 hover:border-accent">
          <BookPlus className="h-6 w-6 text-accent" aria-hidden="true" />
          <span>
            <span className="block font-semibold">إضافة كتاب</span>
            <span className="text-sm text-muted">ارفع PDF أو EPUB</span>
          </span>
        </Link>
        <Link href="/admin/import" className="card flex items-center gap-3 p-5 hover:border-accent">
          <Import className="h-6 w-6 text-accent" aria-hidden="true" />
          <span>
            <span className="block font-semibold">استيراد كتب</span>
            <span className="text-sm text-muted">من Gutenberg وويكي مصدر</span>
          </span>
        </Link>
        <Link href="/admin/reports" className="card flex items-center gap-3 p-5 hover:border-accent">
          <Flag className="h-6 w-6 text-accent" aria-hidden="true" />
          <span>
            <span className="block font-semibold">البلاغات</span>
            <span className="text-sm text-muted">{openReports ? `${openReports} بلاغ مفتوح` : "لا توجد بلاغات مفتوحة"}</span>
          </span>
        </Link>
      </div>

      <section aria-labelledby="security-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="security-heading" className="flex items-center gap-2 text-lg font-bold">
            <ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" />
            الأمان
          </h2>
          <form action={logoutEverywhereAction}>
            <button type="submit" className="btn-danger text-xs">
              تسجيل الخروج من كل الأجهزة
            </button>
          </form>
        </div>
        <dl className="grid grid-cols-3 gap-3">
          {(
            [
              ["محاولات دخول فاشلة (24 ساعة)", security.failed_24h],
              ["عناوين حُظرت مؤقتاً (24 ساعة)", security.locked_24h],
              ["جلسات دخول فعّالة", security.active_sessions],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="card p-4">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="mt-1 text-2xl font-bold">{formatNumber(value ?? 0)}</dd>
            </div>
          ))}
        </dl>
        <div className="card mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">آخر الأحداث الأمنية</caption>
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-4 py-2 text-start font-medium">الوقت</th>
                <th className="px-4 py-2 text-start font-medium">الحدث</th>
                <th className="px-4 py-2 text-start font-medium">IP</th>
                <th className="px-4 py-2 text-start font-medium">تفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {security.events.map((e, i) => (
                <tr key={i} className={e.event.startsWith("login_failed") || e.event.endsWith("_rejected") || e.event === "login_locked" ? "text-red-700 dark:text-red-300" : undefined}>
                  <td className="whitespace-nowrap px-4 py-2 text-muted">{timeFormat.format(e.at)}</td>
                  <td className="px-4 py-2">{EVENT_LABELS[e.event] ?? e.event}</td>
                  <td className="px-4 py-2 font-mono text-xs" dir="ltr">{e.ip}</td>
                  <td className="max-w-xs truncate px-4 py-2 text-muted" dir="auto">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {security.events.length === 0 && <p className="p-4 text-center text-sm text-muted">لا أحداث بعد.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">آخر الكتب المضافة</h2>
        {latest.items.length === 0 ? (
          <p className="text-sm text-muted">لا توجد كتب بعد. ابدأ بالاستيراد أو أضف كتاباً.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {latest.items.map((book) => (
              <li key={book.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <Link href={`/admin/books/${book.id}`} className="min-w-0 truncate font-medium hover:text-accent" dir="auto">
                  {book.title}
                </Link>
                <span className="shrink-0 text-muted">
                  {LANGS[book.lang].short}
                  {!book.published && " · مخفي"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
