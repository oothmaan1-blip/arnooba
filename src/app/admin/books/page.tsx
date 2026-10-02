import type { Metadata } from "next";
import Link from "next/link";
import { Pagination } from "@/components/Pagination";
import { requireAdmin } from "@/lib/auth";
import { listBooks, searchBooks } from "@/lib/books";
import { LANGS, categoryLabel, isLang, type Lang } from "@/lib/categories";
import { bookPath } from "@/lib/paths";
import { formatNumber } from "@/lib/text";

export const metadata: Metadata = { title: "الكتب" };

function href(q: string, lang: Lang | undefined, page: number): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (lang) params.set("lang", lang);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/admin/books${qs ? `?${qs}` : ""}`;
}

export default async function AdminBooksPage({ searchParams }: PageProps<"/admin/books">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 200) : "";
  const lang = isLang(sp.lang) ? sp.lang : undefined;
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const opts = { lang, page, pageSize: 30, includeUnpublished: true };
  const result = q ? await searchBooks(q, opts) : await listBooks({ ...opts, sort: "latest" });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">الكتب</h1>
          <p className="mt-1 text-sm text-muted">{formatNumber(result.total)} نتيجة</p>
        </div>
        <Link href="/admin/books/new" className="btn-primary">
          إضافة كتاب
        </Link>
      </div>

      <form className="mt-6 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="ابحث بالعنوان أو المؤلف" className="input max-w-xs" />
        <select name="lang" defaultValue={lang ?? ""} className="input w-auto">
          <option value="">كل اللغات</option>
          <option value="ar">عربي</option>
          <option value="en">إنكليزي</option>
        </select>
        <button type="submit" className="btn-secondary">
          بحث
        </button>
      </form>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line text-start text-muted">
            <tr>
              <th className="px-4 py-3 text-start font-medium">العنوان</th>
              <th className="px-4 py-3 text-start font-medium">اللغة</th>
              <th className="px-4 py-3 text-start font-medium">التصنيف</th>
              <th className="px-4 py-3 text-start font-medium">الصيغ</th>
              <th className="px-4 py-3 text-start font-medium">تحميل / قراءة</th>
              <th className="px-4 py-3 text-start font-medium">الحالة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {result.items.map((book) => (
              <tr key={book.id} className="hover:bg-surface-2/60">
                <td className="max-w-xs px-4 py-3">
                  <Link href={`/admin/books/${book.id}`} className="block truncate font-medium hover:text-accent" dir="auto">
                    {book.title}
                  </Link>
                  <span className="block truncate text-xs text-muted" dir="auto">
                    {book.author}
                  </span>
                </td>
                <td className="px-4 py-3">{LANGS[book.lang].short}</td>
                <td className="px-4 py-3">{categoryLabel(book.category)}</td>
                <td className="px-4 py-3" dir="ltr">
                  {[book.pdfKey && "PDF", book.epubKey && "EPUB"].filter(Boolean).join(" · ")}
                </td>
                <td className="px-4 py-3">
                  {formatNumber(book.downloads)} / {formatNumber(book.reads)}
                </td>
                <td className="px-4 py-3">
                  {book.published ? (
                    <Link href={bookPath(book)} className="text-accent hover:underline">
                      منشور
                    </Link>
                  ) : (
                    <span className="text-muted">مخفي</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {result.items.length === 0 && <p className="p-6 text-center text-sm text-muted">لا توجد كتب.</p>}
      </div>

      <Pagination page={result.page} total={result.total} pageSize={result.pageSize} hrefFor={(p) => href(q, lang, p)} />
    </div>
  );
}
