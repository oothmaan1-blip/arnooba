import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportForm } from "@/components/ReportForm";
import { getBook } from "@/lib/books";
import { bookPath } from "@/lib/paths";
import { parseIdParam } from "@/lib/text";

export const metadata: Metadata = {
  title: "إبلاغ عن مشكلة",
  robots: { index: false, follow: false },
};

export default async function ReportPage({ params }: PageProps<"/report/[id]">) {
  const id = parseIdParam((await params).id);
  const book = id ? await getBook(id) : null;
  if (!book) notFound();

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold">إبلاغ عن مشكلة</h1>
      <p className="mt-2 text-muted">
        في كتاب{" "}
        <Link href={bookPath(book)} className="font-medium text-ink underline decoration-line underline-offset-4 hover:text-accent" dir="auto">
          {book.title}
        </Link>
      </p>
      <p className="mt-4 text-sm leading-7 text-muted">
        إذا كنت صاحب حقوق هذا الكتاب أو تمثّله، اختر «انتهاك حقوق نشر» واكتب وسيلة للتواصل، وسنزيل الكتاب بعد
        التحقق.
      </p>
      <div className="mt-6">
        <ReportForm bookId={book.id} />
      </div>
    </div>
  );
}
