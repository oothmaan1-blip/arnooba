import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReaderClient } from "@/components/reader/ReaderClient";
import { bookFromParam } from "@/lib/book-page";
import { toCard } from "@/lib/book-view";
import { downloadPath, readPath } from "@/lib/paths";
import { publicUrl } from "@/lib/storage";

export async function generateMetadata({ params }: PageProps<"/read/[slug]">): Promise<Metadata> {
  const book = await bookFromParam((await params).slug);
  return {
    title: book ? `قراءة: ${book.title}` : "القارئ",
    robots: { index: false, follow: true },
  };
}

export default async function ReadPage({ params, searchParams }: PageProps<"/read/[slug]">) {
  const book = await bookFromParam((await params).slug);
  if (!book) notFound();
  const requested = (await searchParams).format;
  const has = { pdf: Boolean(book.pdfKey), epub: Boolean(book.epubKey) };
  const format =
    (requested === "pdf" || requested === "epub") && has[requested] ? requested : has.epub ? "epub" : has.pdf ? "pdf" : null;
  if (!format) notFound();

  const key = format === "pdf" ? book.pdfKey! : book.epubKey!;
  const other = format === "pdf" ? "epub" : "pdf";
  const card = toCard(book);

  return (
    <ReaderClient
      book={{ id: book.id, title: book.title, author: book.author, lang: book.lang, href: card.href, coverUrl: card.coverUrl }}
      format={format}
      fileUrl={publicUrl(key)}
      readHref={readPath(book, format)}
      downloadHref={downloadPath(book, format)}
      switchHref={has[other] ? readPath(book, other) : undefined}
      switchLabel={other === "pdf" ? "نسخة PDF" : "نسخة EPUB"}
    />
  );
}
