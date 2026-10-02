import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  total,
  pageSize,
  hrefFor,
}: {
  page: number;
  total: number;
  pageSize: number;
  hrefFor: (page: number) => string;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <nav aria-label="الصفحات" className="mt-12 flex items-center justify-center gap-3 text-sm">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="btn-secondary" rel="prev">
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
          السابق
        </Link>
      ) : (
        <span className="btn-secondary pointer-events-none opacity-40" aria-hidden="true">
          <ChevronRight className="h-4 w-4" />
          السابق
        </span>
      )}
      <span className="px-2 text-muted">
        صفحة {page} من {pages}
      </span>
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className="btn-secondary" rel="next">
          التالي
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className="btn-secondary pointer-events-none opacity-40" aria-hidden="true">
          التالي
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}
