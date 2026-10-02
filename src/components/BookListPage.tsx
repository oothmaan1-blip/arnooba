import Link from "next/link";
import { Clapperboard } from "lucide-react";
import { BookGrid, EmptyState } from "@/components/BookGrid";
import { CategoryChips } from "@/components/CategoryChips";
import { Pagination } from "@/components/Pagination";
import { toCard } from "@/lib/book-view";
import { SORTS, categoryCounts, filmCount, isSort, listBooks, type SortKey } from "@/lib/books";
import { LANGS, categoryLabel, isCategory, type Lang } from "@/lib/categories";
import { langPath } from "@/lib/paths";
import { cn } from "@/lib/site";
import { BOOK_FORMS, arCount } from "@/lib/text";

type SearchParams = Record<string, string | string[] | undefined>;

export function parseListParams(sp: SearchParams) {
  const category = isCategory(sp.category) ? sp.category : undefined;
  const sort: SortKey = isSort(sp.sort) ? sp.sort : "popular";
  const page = Math.min(10_000, Math.max(1, Math.floor(Number(sp.page)) || 1));
  const film = sp.film === "1";
  return { category, sort, page, film };
}

const FILM_TITLE = "حكايات صارت أفلاماً";

function heading(lang: Lang, category: ReturnType<typeof parseListParams>["category"], film: boolean): string {
  if (film) return category ? `${FILM_TITLE}: ${categoryLabel(category)}` : FILM_TITLE;
  return category ? categoryLabel(category) : LANGS[lang].title;
}

export function listTitle(lang: Lang, sp: SearchParams): string {
  const { category, film } = parseListParams(sp);
  return category || film ? `${heading(lang, category, film)} | ${LANGS[lang].title}` : LANGS[lang].title;
}

export async function BookListPage({ lang, searchParams }: { lang: Lang; searchParams: SearchParams }) {
  const { category, sort, page, film } = parseListParams(searchParams);
  const [result, counts, films] = await Promise.all([
    listBooks({ lang, category, film, sort, page, pageSize: 24 }),
    categoryCounts(lang),
    filmCount(lang),
  ]);
  const filmFlag = film ? 1 : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">{heading(lang, category, film)}</h1>
        <p className="mt-2 text-muted">
          {category || film ? `${LANGS[lang].title} · ` : ""}
          {result.total ? arCount(result.total, BOOK_FORMS) : "لا توجد كتب"}
        </p>
      </header>

      <div className="mb-8 space-y-4">
        <CategoryChips lang={lang} counts={counts} active={category} sort={sort} />
        {films > 0 && (
          <Link
            href={langPath(lang, { film: film ? undefined : 1, sort: sort === "popular" ? undefined : sort })}
            aria-current={film ? "true" : undefined}
            className={cn("chip inline-flex items-center gap-1.5", film && "chip-active")}
          >
            <Clapperboard className="h-4 w-4" aria-hidden="true" />
            {FILM_TITLE} <span className="text-xs opacity-70">{films}</span>
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="الترتيب">
          <span className="text-muted">الترتيب:</span>
          {(Object.keys(SORTS) as SortKey[]).map((key) => (
            <Link
              key={key}
              href={langPath(lang, { category, film: filmFlag, sort: key === "popular" ? undefined : key })}
              aria-current={sort === key ? "true" : undefined}
              className={cn(
                "rounded-lg px-3 py-1.5 transition-colors",
                sort === key ? "bg-surface-2 font-medium text-ink" : "text-muted hover:text-ink",
              )}
            >
              {SORTS[key]}
            </Link>
          ))}
        </div>
      </div>

      {result.items.length === 0 ? (
        <EmptyState title="لا توجد كتب هنا حالياً">
          جرّب تصنيفاً آخر أو <Link href="/search" className="text-accent underline">ابحث عن كتاب</Link>.
        </EmptyState>
      ) : (
        <BookGrid books={result.items.map(toCard)} eagerCount={6} />
      )}

      <Pagination
        page={result.page}
        total={result.total}
        pageSize={result.pageSize}
        hrefFor={(p) => langPath(lang, { category, film: filmFlag, sort: sort === "popular" ? undefined : sort, page: p })}
      />
    </div>
  );
}
