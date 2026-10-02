"use client";

import Link from "next/link";
import { useMemo } from "react";
import { X } from "lucide-react";
import {
  EMPTY_PROGRESS,
  EMPTY_SHELF,
  PROGRESS_KEY,
  SHELF_KEY,
  recentProgress,
  removeProgress,
  toggleShelf,
} from "@/lib/client/library";
import { useLocalJSON } from "@/lib/client/local";
import { ProgressCard } from "./ContinueReading";
import { Cover } from "./Cover";

export function ShelfView() {
  const shelf = useLocalJSON(SHELF_KEY, EMPTY_SHELF);
  const progress = useLocalJSON(PROGRESS_KEY, EMPTY_PROGRESS);
  const reading = useMemo(() => recentProgress(progress.value), [progress.value]);

  if (!shelf.ready || !progress.ready) {
    return <div className="h-40" aria-busy="true" />;
  }

  return (
    <div className="space-y-12">
      <section aria-labelledby="reading-heading">
        <h2 id="reading-heading" className="mb-4 text-xl font-bold">
          أقرأ حالياً
        </h2>
        {reading.length === 0 ? (
          <p className="text-sm text-muted">لم تبدأ قراءة أي كتاب بعد. افتح كتاباً واضغط «اقرأ الآن».</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reading.map((item) => (
              <li key={item.id} className="relative">
                <ProgressCard item={item} />
                <button
                  type="button"
                  onClick={() => removeProgress(item.id)}
                  className="absolute end-2 top-2 rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
                  aria-label={`إزالة «${item.title}» من قائمة القراءة`}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="saved-heading">
        <h2 id="saved-heading" className="mb-4 text-xl font-bold">
          كتب حفظتها
        </h2>
        {shelf.value.length === 0 ? (
          <p className="text-sm text-muted">اضغط «أضف إلى رفّي» في صفحة أي كتاب ليظهر هنا.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {shelf.value.map((book) => (
              <li key={book.id} className="group relative">
                <Link href={book.href} className="block">
                  <Cover id={book.id} title={book.title} author={book.author} coverUrl={book.coverUrl} className="shadow-sm ring-1 ring-black/5" />
                  <p dir="auto" className="mt-2.5 line-clamp-2 text-sm font-semibold leading-6">
                    {book.title}
                  </p>
                  <p dir="auto" className="line-clamp-1 text-xs text-muted">
                    {book.author}
                  </p>
                </Link>
                <button
                  type="button"
                  onClick={() => toggleShelf(book)}
                  className="absolute end-1.5 top-1.5 rounded-full bg-black/55 p-1.5 text-white opacity-90 hover:bg-black/75"
                  aria-label={`إزالة «${book.title}» من رفّي`}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-muted">
        رفّك محفوظ في هذا المتصفح فقط، ولا نرسل أي شيء منه إلى الخادم.
      </p>
    </div>
  );
}
