import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { BookCardData } from "@/lib/book-view";
import { Cover } from "./Cover";

export function BookCard({ book, eager }: { book: BookCardData; eager?: boolean }) {
  return (
    <Link href={book.href} className="group block rounded-lg" prefetch={false}>
      <Cover
        id={book.id}
        title={book.title}
        author={book.author}
        coverUrl={book.coverUrl}
        eager={eager}
        className="shadow-sm ring-1 ring-black/5 transition duration-200 group-hover:-translate-y-1 group-hover:shadow-lg"
      />
      <h3 dir="auto" className="mt-2.5 line-clamp-2 text-sm font-semibold leading-6 group-hover:text-accent">
        {book.title}
      </h3>
      <p dir="auto" className="line-clamp-1 text-xs text-muted">
        {book.author}
      </p>
    </Link>
  );
}

export function BookGrid({ books, eagerCount = 0 }: { books: BookCardData[]; eagerCount?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {books.map((book, i) => (
        <BookCard key={book.id} book={book} eager={i < eagerCount} />
      ))}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  href,
  linkLabel = "عرض الكل",
  id,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  id?: string;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 id={id} className="text-xl font-bold sm:text-2xl">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover">
          {linkLabel}
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children && <div className="mt-2 max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}
