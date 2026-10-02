"use client";

import Link from "next/link";
import { useMemo } from "react";
import { EMPTY_PROGRESS, PROGRESS_KEY, recentProgress, type ReadingProgress } from "@/lib/client/library";
import { useLocalJSON } from "@/lib/client/local";
import { Cover } from "./Cover";

export function ProgressCard({ item }: { item: ReadingProgress }) {
  const percent = Math.max(0, Math.min(100, Math.round(item.percent)));
  return (
    <Link href={item.readHref} className="card flex gap-3 p-3 transition-colors hover:border-accent">
      <div className="w-12 shrink-0">
        <Cover id={item.id} title={item.title} author={item.author} coverUrl={item.coverUrl} className="rounded-md" />
      </div>
      <div className="min-w-0 flex-1 self-center">
        <p dir="auto" className="line-clamp-1 text-sm font-semibold">
          {item.title}
        </p>
        <p dir="auto" className="line-clamp-1 text-xs text-muted">
          {item.author}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
          <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted">
          {percent > 0 ? `قرأت ${percent}%` : "بدأت القراءة"} · {item.format === "pdf" ? "PDF" : "EPUB"}
        </p>
      </div>
    </Link>
  );
}

export function ContinueReading() {
  const { value, ready } = useLocalJSON(PROGRESS_KEY, EMPTY_PROGRESS);
  const items = useMemo(() => recentProgress(value).slice(0, 4), [value]);
  if (!ready || items.length === 0) return null;
  return (
    <section aria-labelledby="continue-heading" className="mx-auto max-w-6xl px-4 pt-10">
      <div className="mb-4 flex items-end justify-between">
        <h2 id="continue-heading" className="text-xl font-bold">
          تابع القراءة
        </h2>
        <Link href="/shelf" className="text-sm font-medium text-accent hover:text-accent-hover">
          رفّي
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <ProgressCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
