"use client";

// Rendered only in the browser (see ReaderClient), so it may read
// localStorage while initializing state.
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AArrowDown,
  AArrowUp,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  ListTree,
  LoaderCircle,
  SunMoon,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { getProgress, saveProgress, type BookRef } from "@/lib/client/library";
import type { EpubHandle, TocItem } from "./EpubView";
import type { PdfHandle } from "./PdfView";
import { READER_THEMES, THEME_ORDER, clamp, loadPrefs, savePrefs, type ReaderPrefs } from "./theme";

const PdfView = dynamic(() => import("./PdfView"), { ssr: false });
const EpubView = dynamic(() => import("./EpubView"), { ssr: false });

export interface ReaderProps {
  book: BookRef;
  format: "pdf" | "epub";
  fileUrl: string;
  readHref: string;
  downloadHref: string;
  switchHref?: string;
  switchLabel?: string;
}

function countRead(id: number) {
  try {
    const key = `arnooba:counted:${id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // sessionStorage blocked: count anyway
  }
  void fetch(`/api/books/${id}/read`, { method: "POST", keepalive: true }).catch(() => undefined);
}

export default function Reader({ book, format, fileUrl, readHref, downloadHref, switchHref, switchLabel }: ReaderProps) {
  const [prefs, setPrefs] = useState<ReaderPrefs>(loadPrefs);
  const [saved] = useState(() => getProgress(book.id, format));
  const [ready, setReady] = useState(false);
  const [loadRatio, setLoadRatio] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<{ current: number; total: number } | null>(null);
  const [percent, setPercent] = useState<number | null>(saved?.percent ?? null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  const epubRef = useRef<EpubHandle | null>(null);
  const pdfRef = useRef<PdfHandle | null>(null);
  const pendingSave = useRef<{ location: string; percent: number } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const theme = READER_THEMES[prefs.theme];
  const rtl = book.lang === "ar";

  const flush = useCallback(() => {
    clearTimeout(saveTimer.current);
    const pending = pendingSave.current;
    if (!pending) return;
    pendingSave.current = null;
    saveProgress({ ...book, format, readHref, location: pending.location, percent: pending.percent, updatedAt: Date.now() });
  }, [book, format, readHref]);

  const remember = useCallback(
    (location: string, pct: number) => {
      pendingSave.current = { location, percent: pct };
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, 800);
    },
    [flush],
  );

  useEffect(() => {
    countRead(book.id);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [book.id, flush]);

  function updatePrefs(patch: Partial<ReaderPrefs>) {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      savePrefs(next);
      return next;
    });
  }

  const onPdfPage = useCallback(
    (current: number, total: number) => {
      setPage({ current, total });
      const pct = total > 1 ? ((current - 1) / (total - 1)) * 100 : 100;
      setPercent(pct);
      remember(String(current), pct);
    },
    [remember],
  );

  const onEpubLocation = useCallback(
    (cfi: string, pct: number | null) => {
      if (pct !== null) setPercent(pct);
      remember(cfi, pct ?? saved?.percent ?? 0);
    },
    [remember, saved?.percent],
  );

  const onReady = useCallback(() => setReady(true), []);
  const onError = useCallback((message: string) => setError(message), []);

  const isPdf = format === "pdf";
  const PrevIcon = rtl || isPdf ? ChevronRight : ChevronLeft;
  const NextIcon = rtl || isPdf ? ChevronLeft : ChevronRight;
  const status = error
    ? "حدث خطأ"
    : !ready
      ? "جارٍ فتح الكتاب…"
      : isPdf && page
        ? `صفحة ${page.current} من ${page.total}`
        : percent !== null
          ? `قرأت ${Math.round(percent)}%`
          : "جارٍ حساب الصفحات…";

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: theme.bg, color: theme.fg }}>
      <header className="flex h-14 shrink-0 items-center gap-0.5 border-b px-1.5 sm:gap-1 sm:px-3" style={{ borderColor: theme.line }}>
        <Link href={book.href} className="rbtn" aria-label="العودة إلى صفحة الكتاب">
          <ArrowRight className="h-5 w-5" aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1 px-1">
          <p dir="auto" className="truncate text-sm font-semibold">
            {book.title}
          </p>
          <p className="truncate text-xs" style={{ color: theme.muted }} aria-live="polite">
            {status}
          </p>
        </div>
        {!isPdf && toc.length > 0 && (
          <button type="button" className="rbtn" onClick={() => setTocOpen(true)} aria-label="الفهرس">
            <ListTree className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        {isPdf ? (
          <>
            <button type="button" className="rbtn" onClick={() => updatePrefs({ zoom: clamp(prefs.zoom - 0.15, 0.5, 3) })} aria-label="تصغير">
              <ZoomOut className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" className="rbtn" onClick={() => updatePrefs({ zoom: clamp(prefs.zoom + 0.15, 0.5, 3) })} aria-label="تكبير">
              <ZoomIn className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            <button type="button" className="rbtn" onClick={() => updatePrefs({ fontScale: clamp(prefs.fontScale - 10, 70, 220) })} aria-label="تصغير الخط">
              <AArrowDown className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" className="rbtn" onClick={() => updatePrefs({ fontScale: clamp(prefs.fontScale + 10, 70, 220) })} aria-label="تكبير الخط">
              <AArrowUp className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        )}
        <button
          type="button"
          className="rbtn"
          onClick={() => updatePrefs({ theme: THEME_ORDER[(THEME_ORDER.indexOf(prefs.theme) + 1) % THEME_ORDER.length] })}
          aria-label={`المظهر: ${theme.label}`}
          title={`المظهر: ${theme.label}`}
        >
          <SunMoon className="h-5 w-5" aria-hidden="true" />
        </button>
        {switchHref && (
          <Link href={switchHref} className="rbtn hidden px-2.5 text-xs font-semibold sm:inline-flex" replace>
            {switchLabel}
          </Link>
        )}
        <a href={downloadHref} className="rbtn" aria-label="تحميل الكتاب" rel="nofollow">
          <Download className="h-5 w-5" aria-hidden="true" />
        </a>
      </header>

      <div className="relative min-h-0 flex-1">
        {isPdf ? (
          <PdfView
            url={fileUrl}
            initialPage={Math.max(1, Number(saved?.location) || 1)}
            zoom={prefs.zoom}
            theme={prefs.theme}
            handleRef={pdfRef}
            onReady={onReady}
            onPage={onPdfPage}
            onLoadProgress={setLoadRatio}
            onError={onError}
          />
        ) : (
          <EpubView
            url={fileUrl}
            lang={book.lang}
            initialCfi={saved?.location ?? null}
            theme={prefs.theme}
            fontScale={prefs.fontScale}
            handleRef={epubRef}
            onReady={onReady}
            onLocation={onEpubLocation}
            onToc={setToc}
            onLoadProgress={setLoadRatio}
            onError={onError}
          />
        )}

        {!ready && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: theme.bg }}>
            <LoaderCircle className="h-8 w-8 animate-spin" style={{ color: theme.accent }} aria-hidden="true" />
            <p className="text-sm" style={{ color: theme.muted }}>
              {loadRatio > 0 && loadRatio < 1 ? `جارٍ التحميل ${Math.round(loadRatio * 100)}%` : "جارٍ فتح الكتاب…"}
            </p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: theme.bg }}>
            <p className="font-semibold">{error}</p>
            <p className="text-sm" style={{ color: theme.muted }}>
              يمكنك تحميل الملف وفتحه بتطبيق على جهازك.
            </p>
            <a href={downloadHref} className="btn-primary" rel="nofollow">
              <Download className="h-4 w-4" aria-hidden="true" />
              تحميل الكتاب
            </a>
          </div>
        )}
      </div>

      <footer
        className="flex h-12 shrink-0 items-center justify-between gap-2 border-t px-2"
        style={{ borderColor: theme.line }}
        dir={rtl || isPdf ? "rtl" : "ltr"}
      >
        <button
          type="button"
          className="rbtn"
          aria-label="الصفحة السابقة"
          onClick={() => (isPdf ? pdfRef.current?.step(-1) : epubRef.current?.prev())}
        >
          <PrevIcon className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="h-1 max-w-md flex-1 overflow-hidden rounded-full" style={{ background: theme.line }} aria-hidden="true">
          <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.round(percent ?? 0)}%`, background: theme.accent }} />
        </div>
        <button
          type="button"
          className="rbtn"
          aria-label="الصفحة التالية"
          onClick={() => (isPdf ? pdfRef.current?.step(1) : epubRef.current?.next())}
        >
          <NextIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </footer>

      {tocOpen && (
        <div
          className="absolute inset-0 z-10 flex"
          role="dialog"
          aria-modal="true"
          aria-label="الفهرس"
          onKeyDown={(e) => e.key === "Escape" && setTocOpen(false)}
        >
          <nav className="flex w-80 max-w-[85vw] flex-col shadow-2xl" style={{ background: theme.bg }}>
            <div className="flex h-14 items-center justify-between border-b px-4" style={{ borderColor: theme.line }}>
              <p className="font-semibold">الفهرس</p>
              <button type="button" className="rbtn" onClick={() => setTocOpen(false)} aria-label="إغلاق">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto py-2" dir={rtl ? "rtl" : "ltr"}>
              {toc.map((item, i) => (
                <li key={`${item.href}-${i}`}>
                  <button
                    type="button"
                    className="block w-full px-4 py-2.5 text-start text-sm hover:bg-[color-mix(in_srgb,currentColor_8%,transparent)]"
                    style={{ paddingInlineStart: `${16 + item.depth * 14}px` }}
                    onClick={() => {
                      epubRef.current?.goTo(item.href);
                      setTocOpen(false);
                    }}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <button type="button" className="flex-1 bg-black/40" onClick={() => setTocOpen(false)} aria-label="إغلاق الفهرس" />
        </div>
      )}
    </div>
  );
}
