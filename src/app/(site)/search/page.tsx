import type { Metadata } from "next";
import Link from "next/link";
import { BookGrid, EmptyState, SectionHeader } from "@/components/BookGrid";
import { Pagination } from "@/components/Pagination";
import { SearchForm } from "@/components/SearchForm";
import { toCard } from "@/lib/book-view";
import { clientIp } from "@/lib/auth";
import { searchBooks } from "@/lib/books";
import { UNKNOWN_IP } from "@/lib/ip";
import { rateLimit } from "@/lib/rate-limit";
import { CATEGORIES, LANGS, isLang, type Lang } from "@/lib/categories";
import { BOOK_FORMS, arCount } from "@/lib/text";

type SP = Record<string, string | string[] | undefined>;

function readQuery(sp: SP): string {
  return typeof sp.q === "string" ? sp.q.trim().slice(0, 200) : "";
}

function searchHref(q: string, lang?: Lang, page?: number): string {
  const params = new URLSearchParams({ q });
  if (lang) params.set("lang", lang);
  if (page && page > 1) params.set("page", String(page));
  return `/search?${params}`;
}

export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const q = readQuery(await searchParams);
  return {
    title: q ? `نتائج البحث عن «${q}»` : "البحث",
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const sp = await searchParams;
  const q = readQuery(sp);
  const lang = isLang(sp.lang) ? sp.lang : undefined;
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const ip = await clientIp();
  const throttled = Boolean(q) && ip !== UNKNOWN_IP && !rateLimit(`search:${ip}`, 60, 60_000);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">البحث</h1>
      <SearchForm defaultValue={q} large className="mt-5 max-w-2xl" id="search-page-q" />

      {throttled ? (
        <p className="mt-10 text-muted" role="alert">
          بحثت كثيراً خلال دقيقة واحدة. انتظر قليلاً ثم حاول مرة أخرى.
        </p>
      ) : !q ? (
        <div className="mt-10 space-y-6">
          <p className="text-muted">اكتب اسم كتاب أو مؤلف. البحث يفهم الكتابة بالهمزة أو بدونها وبالتاء المربوطة أو الهاء.</p>
          {(["ar", "en"] as const).map((l) => (
            <div key={l}>
              <p className="mb-2 text-sm font-semibold">{LANGS[l].label}</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <Link key={c.id} href={`/${l}?category=${c.id}`} className="chip">
                    {c.ar}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : lang ? (
        <LanguageResults q={q} lang={lang} page={page} />
      ) : (
        <BothLanguages q={q} />
      )}
    </div>
  );
}

async function BothLanguages({ q }: { q: string }) {
  const [ar, en] = await Promise.all([
    searchBooks(q, { lang: "ar", pageSize: 12 }),
    searchBooks(q, { lang: "en", pageSize: 12 }),
  ]);
  if (ar.total === 0 && en.total === 0) {
    return (
      <div className="mt-10">
        <EmptyState title={`لا توجد نتائج لـ «${q}»`}>جرّب كلمة أقصر، أو اسم المؤلف فقط.</EmptyState>
      </div>
    );
  }
  return (
    <div className="mt-10 space-y-14">
      {([["ar", ar], ["en", en]] as const).map(([l, result]) =>
        result.total === 0 ? null : (
          <section key={l} aria-labelledby={`results-${l}`}>
            <SectionHeader
              id={`results-${l}`}
              title={LANGS[l].label}
              subtitle={arCount(result.total, BOOK_FORMS)}
              href={result.total > result.items.length ? searchHref(q, l) : undefined}
              linkLabel="كل النتائج"
            />
            <BookGrid books={result.items.map(toCard)} />
          </section>
        ),
      )}
    </div>
  );
}

async function LanguageResults({ q, lang, page }: { q: string; lang: Lang; page: number }) {
  const result = await searchBooks(q, { lang, page, pageSize: 24 });
  return (
    <div className="mt-10">
      <SectionHeader title={LANGS[lang].label} subtitle={result.total ? arCount(result.total, BOOK_FORMS) : undefined} href={searchHref(q)} linkLabel="كل اللغات" />
      {result.items.length === 0 ? (
        <EmptyState title={`لا توجد نتائج لـ «${q}»`} />
      ) : (
        <BookGrid books={result.items.map(toCard)} />
      )}
      <Pagination page={result.page} total={result.total} pageSize={result.pageSize} hrefFor={(p) => searchHref(q, lang, p)} />
    </div>
  );
}
