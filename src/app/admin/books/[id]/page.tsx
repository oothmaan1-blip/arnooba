import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookForm } from "@/components/admin/BookForm";
import { requireAdmin } from "@/lib/auth";
import { getBook } from "@/lib/books";
import { bookPath } from "@/lib/paths";
import { publicUrl } from "@/lib/storage";
import { parseIdParam } from "@/lib/text";

export const metadata: Metadata = { title: "تعديل كتاب" };

export default async function EditBookPage({ params, searchParams }: PageProps<"/admin/books/[id]">) {
  await requireAdmin();
  const id = parseIdParam((await params).id);
  const book = id ? await getBook(id, { includeUnpublished: true }) : null;
  if (!book) notFound();
  const saved = (await searchParams).saved === "1";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">تعديل كتاب</h1>
          <p className="mt-1 text-sm text-muted" dir="auto">{book.title}</p>
        </div>
        {book.published && (
          <Link href={bookPath(book)} className="btn-secondary">
            عرض في الموقع
          </Link>
        )}
      </div>
      <BookForm
        key={book.updatedAt.toISOString()}
        saved={saved}
        initial={{
          id: book.id,
          lang: book.lang,
          title: book.title,
          author: book.author,
          description: book.description,
          category: book.category,
          year: book.year,
          source: book.source,
          sourceUrl: book.sourceUrl,
          license: book.license,
          film: book.film,
          complete: book.complete,
          published: book.published,
          pages: book.pagesApprox ? null : book.pages,
          publicHref: bookPath(book),
          current: {
            pdf: book.pdfKey ? { url: publicUrl(book.pdfKey), size: book.pdfSize } : null,
            epub: book.epubKey ? { url: publicUrl(book.epubKey), size: book.epubSize } : null,
            cover: book.coverKey ? { url: publicUrl(book.coverKey) } : null,
          },
        }}
      />
    </div>
  );
}
