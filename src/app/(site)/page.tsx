import Link from "next/link";
import { BookOpenText, Download, ShieldCheck } from "lucide-react";
import { BookGrid, EmptyState, SectionHeader } from "@/components/BookGrid";
import { CategoryChips } from "@/components/CategoryChips";
import { ContinueReading } from "@/components/ContinueReading";
import { BrandMark } from "@/components/Logo";
import { SearchForm } from "@/components/SearchForm";
import { toCard } from "@/lib/book-view";
import { categoryCounts, countByLang, filmCount, listBooks } from "@/lib/books";
import { LANGS, type Lang } from "@/lib/categories";
import { BOOK_FORMS, arCount } from "@/lib/text";

async function LanguageShelf({ lang, total }: { lang: Lang; total: number }) {
  const [books, counts] = await Promise.all([
    listBooks({ lang, sort: "popular", pageSize: 12 }),
    categoryCounts(lang),
  ]);
  const headingId = `shelf-${lang}`;
  return (
    <section aria-labelledby={headingId} className="mx-auto max-w-6xl px-4 pt-14">
      <SectionHeader
        id={headingId}
        title={LANGS[lang].label}
        subtitle={total ? `${arCount(total, BOOK_FORMS)} للقراءة والتحميل` : undefined}
        href={total ? LANGS[lang].path : undefined}
      />
      {books.items.length === 0 ? (
        <EmptyState title="لا توجد كتب هنا بعد">ستظهر الكتب هنا بمجرد إضافتها من لوحة التحكم.</EmptyState>
      ) : (
        <div className="space-y-6">
          <CategoryChips lang={lang} counts={counts} />
          <BookGrid books={books.items.map(toCard)} eagerCount={lang === "ar" ? 6 : 0} />
        </div>
      )}
    </section>
  );
}

async function FilmShelf({ lang }: { lang: Lang }) {
  const [films, shelf, total] = await Promise.all([
    listBooks({ lang, film: true, sort: "popular", pageSize: 18 }),
    listBooks({ lang, sort: "popular", pageSize: 12 }), // what LanguageShelf shows above
    filmCount(lang),
  ]);
  if (!films.items.length) return null;
  // Prefer films not already on the shelf above, then fill up with the rest.
  const shown = new Set(shelf.items.map((b) => b.id));
  const items = [...films.items.filter((b) => !shown.has(b.id)), ...films.items.filter((b) => shown.has(b.id))].slice(0, 6);
  const headingId = `films-${lang}`;
  return (
    <section aria-labelledby={headingId} className="mx-auto max-w-6xl px-4 pt-14">
      <SectionHeader
        id={headingId}
        title="حكايات صارت أفلاماً"
        subtitle={`اقرأ القصة الأصلية قبل أن تشاهد الفيلم: ${arCount(total, BOOK_FORMS)}`}
        href={`${LANGS[lang].path}?film=1`}
      />
      <BookGrid books={items.map(toCard)} />
    </section>
  );
}

const FEATURES = [
  { icon: ShieldCheck, title: "مجاني وقانوني", text: "كل الكتب في الملكية العامة أو برخص حرّة، فتقرأ وتحمّل وأنت مرتاح." },
  { icon: BookOpenText, title: "اقرأ من المتصفح", text: "قارئ مريح بوضع ليلي وتكبير للخط، ويتذكّر أين توقفت." },
  { icon: Download, title: "حمّل وخذه معك", text: "نسخ PDF وEPUB تفتح على الموبايل والكمبيوتر وقارئات الكتب." },
];

export default async function HomePage() {
  const counts = await countByLang();
  return (
    <>
      <section className="wash border-b border-line">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-4 pb-14 pt-12 text-center sm:pt-16">
          <BrandMark className="h-36 drop-shadow-[0_10px_18px_rgba(91,58,34,0.22)] sm:h-44" sizes="(min-width: 640px) 192px, 160px" priority />
          <h1 className="mt-5 text-3xl font-bold leading-tight sm:text-5xl sm:leading-tight">
            كتب مجانية، تقرأها أونلاين أو تحمّلها
          </h1>
          <p className="mt-4 max-w-xl text-base leading-8 text-muted sm:text-lg">
            أرنوبة مكتبة عربية وإنكليزية مجانية: روايات وأدب وتاريخ وفلسفة وأكثر، بلا تسجيل وبلا إعلانات مزعجة.
          </p>
          <SearchForm large className="mt-8 max-w-xl" id="hero-q" />
          <div className="mt-5 flex flex-wrap justify-center gap-2 text-sm">
            <Link href="/ar" className="chip">
              كتب عربية <span className="text-xs opacity-70">{counts.ar}</span>
            </Link>
            <Link href="/en" className="chip">
              كتب إنكليزية <span className="text-xs opacity-70">{counts.en}</span>
            </Link>
          </div>
        </div>
      </section>

      <ContinueReading />
      <LanguageShelf lang="ar" total={counts.ar} />
      <FilmShelf lang="ar" />
      <LanguageShelf lang="en" total={counts.en} />
      <FilmShelf lang="en" />

      <section aria-label="لماذا أرنوبة" className="mx-auto max-w-6xl px-4 pt-20">
        <ul className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="card p-6">
              <Icon className="h-6 w-6 text-accent" aria-hidden="true" />
              <p className="mt-3 font-semibold">{title}</p>
              <p className="mt-1 text-sm leading-7 text-muted">{text}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
