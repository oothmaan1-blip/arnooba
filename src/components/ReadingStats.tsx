"use client";

import Link from "next/link";
import { BookOpenCheck, Clock3, LibraryBig } from "lucide-react";
import { PROGRESS_KEY, READING_TIME_KEY, EMPTY_PROGRESS, type ReadingProgress } from "@/lib/client/library";
import { useLocalJSON } from "@/lib/client/local";

function duration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours) return `${hours} ساعة${minutes ? ` و${minutes} دقيقة` : ""}`;
  return `${minutes} دقيقة`;
}

export function ReadingStats() {
  const { value: progress, ready: progressReady } = useLocalJSON<Record<string, ReadingProgress>>(PROGRESS_KEY, EMPTY_PROGRESS);
  const { value: seconds, ready: timeReady } = useLocalJSON<number>(READING_TIME_KEY, 0);
  const safeProgress = progress && typeof progress === "object" ? progress : EMPTY_PROGRESS;
  const entries = Object.values(safeProgress).filter((entry) => entry && typeof entry.id === "number");
  const booksStarted = new Set(entries.map((entry) => entry.id)).size;
  const booksFinished = new Set(entries.filter((entry) => entry.percent >= 99).map((entry) => entry.id)).size;
  const ready = progressReady && timeReady;

  const stats = [
    { label: "كتب بدأت قراءتها", value: ready ? booksStarted : "—", icon: LibraryBig },
    { label: "كتب أكملتها", value: ready ? booksFinished : "—", icon: BookOpenCheck },
    { label: "وقت القراءة", value: ready ? duration(typeof seconds === "number" && Number.isFinite(seconds) ? Math.max(0, seconds) : 0) : "—", icon: Clock3 },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:py-14">
      <h1 className="text-3xl font-bold">إحصائياتي القرائية</h1>
      <p className="mt-2 leading-7 text-muted">إحصائياتك محفوظة على هذا الجهاز فقط، بدون حساب أو إرسال بياناتك.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <section key={label} className="card p-5">
            <Icon className="h-6 w-6 text-accent" aria-hidden="true" />
            <p className="mt-4 text-sm text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold" aria-live="polite">{value}</p>
          </section>
        ))}
      </div>
      {!booksStarted && ready && (
        <div className="card mt-8 p-6 text-center">
          <p className="font-semibold">رح تظهر إحصائياتك من تبدأ القراءة</p>
          <Link href="/ar" className="btn-primary mt-4">اختار كتاب</Link>
        </div>
      )}
      <p className="mt-6 text-xs leading-6 text-muted">وقت القراءة يُحسب أثناء فتح القارئ والصفحة ظاهرة، وقد يختلف قليلاً عن الوقت الفعلي.</p>
    </div>
  );
}
