import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { BadgeCheck, BookOpen, Clapperboard, Download, ExternalLink, Flag } from "lucide-react";
import { BookGrid, SectionHeader } from "@/components/BookGrid";
import { Cover } from "@/components/Cover";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ShareButton } from "@/components/ShareButton";
import { bookFromParam, sameSlug } from "@/lib/book-page";
import { toCard } from "@/lib/book-view";
import { similarBooks, type Book } from "@/lib/books";
import { LANGS, categoryLabel, licenseLabel } from "@/lib/categories";
import { bookPath, downloadPath, langPath, readPath } from "@/lib/paths";
import { siteUrl } from "@/lib/site";
import { publicUrl } from "@/lib/storage";
import { DOWNLOAD_FORMS, READ_FORMS, arCount, excerpt, formatBytes, pagesLabel } from "@/lib/text";
import { safeExternalUrl } from "@/lib/url";

const LICENSE_DEEDS: Record<string, string> = {
  "cc-by": "https://creativecommons.org/licenses/by/4.0/deed.ar",
  "cc-by-sa": "https://creativecommons.org/licenses/by-sa/4.0/deed.ar",
};

function describe(book: Book): string {
  return excerpt(
    book.description ||
      `اقرأ كتاب «${book.title}»${book.author ? ` لـ${book.author}` : ""} أونلاين أو حمّله مجاناً من أرنوبة.`,
  );
}

export async function generateMetadata({ params }: PageProps<"/book/[slug]">): Promise<Metadata> {
  const book = await bookFromParam((await params).slug);
  if (!book) return { title: "الكتاب غير موجود" };
  const title = book.author ? `${book.title} - ${book.author}` : book.title;
  return {
    title,
    description: describe(book),
    alternates: { canonical: bookPath(book) },
    openGraph: {
      type: "book",
      title,
      description: describe(book),
      images: book.coverKey ? [{ url: publicUrl(book.coverKey) }] : undefined,
    },
  };
}

export default async function BookPage({ params }: PageProps<"/book/[slug]">) {
  const { slug } = await params;
  const book = await bookFromParam(slug);
  if (!book) notFound();
  const canonical = bookPath(book);
  if (!sameSlug(`/book/${slug}`, canonical)) permanentRedirect(encodeURI(canonical));

  const similar = await similarBooks(book, 6);
  const card = toCard(book);
  const defaultFormat = book.epubKey ? "epub" : "pdf";
  const canRead = Boolean(book.epubKey || book.pdfKey);
  const sourceUrl = safeExternalUrl(book.sourceUrl);
  const pages = pagesLabel(book.pages, book.pagesApprox);
  const coverAbsolute = card.coverUrl ? new URL(card.coverUrl, siteUrl()).toString() : undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    author: book.author ? { "@type": "Person", name: book.author } : undefined,
    inLanguage: book.lang,
    description: book.description || undefined,
    image: coverAbsolute,
    url: new URL(encodeURI(canonical), siteUrl()).toString(),
    bookFormat: "https://schema.org/EBook",
    isAccessibleForFree: true,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <script
        type="application/ld+json"
        // Escaping "<" keeps a hostile title from closing the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <nav aria-label="مسار التنقل" className="mb-6 text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/" className="hover:text-ink">الرئيسية</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href={LANGS[book.lang].path} className="hover:text-ink">{LANGS[book.lang].label}</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href={langPath(book.lang, { category: book.category })} className="hover:text-ink">{categoryLabel(book.category)}</Link></li>
        </ol>
      </nav>

      <div className="grid gap-8 md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr] lg:gap-12">
        <div className="mx-auto w-48 sm:w-56 md:w-full">
          <Cover id={book.id} title={book.title} author={book.author} coverUrl={card.coverUrl} eager className="shadow-xl ring-1 ring-black/10" />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-medium text-accent">
            {categoryLabel(book.category)} · {LANGS[book.lang].short}
          </p>
          <h1 dir="auto" className="mt-2 text-3xl font-bold leading-tight sm:text-4xl sm:leading-tight">
            {book.title}
          </h1>
          {book.author && (
            <p dir="auto" className="mt-2 text-lg text-muted">
              {book.author}
            </p>
          )}
          {(book.complete || book.film) && (
            <ul className="mt-4 flex flex-wrap gap-2 text-sm">
              {book.complete && (
                <li
                  className="inline-flex items-center gap-1.5 rounded-full bg-green-600/10 px-3 py-1 font-medium text-green-700 dark:text-green-400"
                  title="راجعنا أن هذه نسخة كاملة من العمل، وليست عيّنة أو جزءاً منه."
                >
                  <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                  نسخة كاملة
                </li>
              )}
              {book.film && (
                <li className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 font-medium text-accent">
                  <Clapperboard className="h-4 w-4" aria-hidden="true" />
                  <span>
                    تحوّلت إلى فيلم: <span dir="auto">{book.film}</span>
                  </span>
                </li>
              )}
            </ul>
          )}

          <div className="mt-7 flex flex-wrap gap-2.5">
            {canRead && (
              <Link href={readPath(book, defaultFormat)} className="btn-primary px-6 text-base">
                <BookOpen className="h-5 w-5" aria-hidden="true" />
                اقرأ الآن
              </Link>
            )}
            {book.pdfKey && (
              <a href={downloadPath(book, "pdf")} rel="nofollow" className="btn-secondary">
                <Download className="h-4 w-4" aria-hidden="true" />
                تحميل PDF
                {book.pdfSize ? <span dir="ltr" className="text-xs text-muted">{formatBytes(book.pdfSize)}</span> : null}
              </a>
            )}
            {book.epubKey && (
              <a href={downloadPath(book, "epub")} rel="nofollow" className="btn-secondary">
                <Download className="h-4 w-4" aria-hidden="true" />
                تحميل EPUB
                {book.epubSize ? <span dir="ltr" className="text-xs text-muted">{formatBytes(book.epubSize)}</span> : null}
              </a>
            )}
            <FavoriteButton
              book={{ id: book.id, title: book.title, author: book.author, lang: book.lang, href: card.href, coverUrl: card.coverUrl }}
            />
            <ShareButton title={book.title} />
          </div>
          {book.epubKey && (
            <p className="mt-3 text-xs text-muted">
              نسخة EPUB تتكيّف مع حجم الشاشة، وتفتحها تطبيقات قراءة الكتب على الموبايل والكمبيوتر.
            </p>
          )}

          <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["اللغة", book.lang === "ar" ? "العربية" : "الإنكليزية"],
              ["الطول", pages || "غير محدد"],
              ["التحميلات", arCount(book.downloads, DOWNLOAD_FORMS)],
              ["القراءات", arCount(book.reads, READ_FORMS)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-surface-2 px-4 py-3">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="mt-1 text-sm font-semibold">{value}</dd>
              </div>
            ))}
          </dl>

          {book.description && (
            <section aria-labelledby="about-book" className="mt-8">
              <h2 id="about-book" className="text-lg font-bold">
                عن الكتاب
              </h2>
              <p dir="auto" className="mt-2 whitespace-pre-line leading-8 text-ink/90">
                {book.description}
              </p>
            </section>
          )}

          <section aria-label="المصدر والرخصة" className="mt-8 space-y-1.5 rounded-2xl border border-line p-4 text-sm leading-7 text-muted">
            <p>
              <span className="font-medium text-ink">المصدر: </span>
              {sourceUrl ? (
                <a href={sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-accent hover:underline">
                  {book.source || "رابط المصدر"}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ) : (
                book.source || "أرنوبة"
              )}
            </p>
            <p>
              <span className="font-medium text-ink">الرخصة: </span>
              {LICENSE_DEEDS[book.license] ? (
                <a href={LICENSE_DEEDS[book.license]} target="_blank" rel="noopener noreferrer nofollow" className="text-accent hover:underline">
                  {licenseLabel(book.license)}
                </a>
              ) : (
                licenseLabel(book.license)
              )}
              {book.license === "cc-by-sa" ? " (النص الأصلي في الملكية العامة)" : ""}
            </p>
            {book.sourceId?.startsWith("hindawi:") && (
              <p>
                الكتاب كما نشرته مؤسسة هنداوي (النص والترجمة والغلاف)، والأصل في الملكية العامة. التعديل الوحيد: حذف خطوط غير مستخدمة لتصغير حجم الملف.
              </p>
            )}
            <p>
              <Link href={`/report/${book.id}`} className="inline-flex items-center gap-1.5 hover:text-ink">
                <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                إبلاغ عن مشكلة في هذا الكتاب (مثل صفحات ناقصة)
              </Link>
            </p>
          </section>
        </div>
      </div>

      {similar.length > 0 && (
        <section aria-labelledby="similar" className="mt-16">
          <SectionHeader id="similar" title="قد يعجبك أيضاً" />
          <BookGrid books={similar.map(toCard)} />
        </section>
      )}
    </div>
  );
}
