"use client";

// Rendered only in the browser (see ReaderClient), so it may read
// localStorage while initializing state.
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  ListTree,
  LoaderCircle,
  Settings2,
  Bookmark,
  Quote,
  X,
} from "lucide-react";
import { addReadingSeconds, bookmarksFor, getProgress, removeBookmark, saveProgress, toggleBookmark, type BookRef, type ReadingBookmark } from "@/lib/client/library";
import type { EpubHandle, TocItem } from "./EpubView";
import type { PdfHandle } from "./PdfView";
import { READER_THEMES, loadPrefs, savePrefs, type ReaderPrefs } from "./theme";
import { ReaderSettingsPanel } from "./ReaderSettingsPanel";
import { BookmarkPanel } from "./BookmarkPanel";
import { QuoteDialog } from "./QuoteDialog";
import { REACTION_OPTIONS, reactionVisitorId, rememberReaction, selectedReaction, type ReactionCounts, type ReactionId } from "@/lib/client/reactions";

const PdfView = dynamic(() => import("./PdfView"), { ssr: false });
const EpubView = dynamic(() => import("./EpubView"), { ssr: false });
const OFFLINE_BOOK_CACHE = "arnooba-offline-books-v1";
const OFFLINE_PAGE_CACHE = "arnooba-pwa-v1-pages";
const MAX_OFFLINE_BOOK_BYTES = 100 * 1024 * 1024;

export interface ReaderProps {
  book: BookRef;
  format: "pdf" | "epub";
  fileUrl: string;
  fileSize: number | null;
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

export default function Reader({ book, format, fileUrl, fileSize, readHref, downloadHref, switchHref, switchLabel }: ReaderProps) {
  const [prefs, setPrefs] = useState<ReaderPrefs>(loadPrefs);
  const [saved] = useState(() => getProgress(book.id, format));
  const [ready, setReady] = useState(false);
  const [loadRatio, setLoadRatio] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState<{ current: number; total: number } | null>(null);
  const [percent, setPercent] = useState<number | null>(saved?.percent ?? null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [quoteText, setQuoteText] = useState("");
  const [bookmarkState, setBookmarkState] = useState(() => ({ bookId: book.id, items: bookmarksFor(book.id) }));
  const [position, setPosition] = useState({ location: saved?.location ?? "", chapter: "", atEnd: false });
  const [reactionCounts, setReactionCounts] = useState<ReactionCounts>({});
  const [reactionMessage, setReactionMessage] = useState("");
  const [offlineState, setOfflineState] = useState<"checking" | "ready" | "saved" | "saving" | "unsupported">(() => "caches" in window ? "ready" : "unsupported");
  const [offlineMessage, setOfflineMessage] = useState("");
  const epubRef = useRef<EpubHandle | null>(null);
  const pdfRef = useRef<PdfHandle | null>(null);
  const pendingSave = useRef<{ location: string; percent: number } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const theme = READER_THEMES[prefs.theme];
  const rtl = book.lang === "ar";
  const bookmarks = (bookmarkState.bookId === book.id ? bookmarkState.items : bookmarksFor(book.id)).filter((item) => item.format === format);
  const pickedReaction = position.chapter ? selectedReaction(book.id, position.chapter) : null;

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

  useEffect(() => {
    let cancelled = false;
    if (!("caches" in window)) return;
    caches.open(OFFLINE_BOOK_CACHE).then((cache) => cache.match(fileUrl)).then((cached) => {
      if (!cancelled) setOfflineState(cached ? "saved" : "ready");
    }).catch(() => { if (!cancelled) setOfflineState("unsupported"); });
    return () => { cancelled = true; };
  }, [fileUrl]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/books/${book.id}/reactions`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { counts?: ReactionCounts } | null) => data?.counts && setReactionCounts(data.counts))
      .catch(() => undefined);
    return () => controller.abort();
  }, [book.id]);

  useEffect(() => {
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      if (document.visibilityState === "visible") addReadingSeconds(Math.min(30, Math.floor((now - last) / 1000)));
      last = now;
    };
    const visibilityChanged = () => { last = Date.now(); };
    const timer = window.setInterval(tick, 15_000);
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("pagehide", tick);
    return () => {
      tick();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("pagehide", tick);
    };
  }, []);

  function updatePrefs(patch: Partial<ReaderPrefs>) {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      savePrefs(next);
      return next;
    });
  }

  function countsForChapter(href: string): Partial<Record<ReactionId, number>> {
    if (reactionCounts[href]) return reactionCounts[href];
    const base = href.split("#", 1)[0];
    return Object.entries(reactionCounts).find(([key]) => key.split("#", 1)[0] === base)?.[1] ?? {};
  }

  function labelForChapter(href: string): string | undefined {
    const base = href.split("#", 1)[0];
    return toc.find((item) => item.href === href || item.href.split("#", 1)[0] === base)?.label;
  }

  const onPdfPage = useCallback(
    (current: number, total: number) => {
      setPage({ current, total });
      setPosition({ location: String(current), chapter: `صفحة ${current}`, atEnd: current === total });
      const pct = total > 1 ? ((current - 1) / (total - 1)) * 100 : 100;
      setPercent(pct);
      remember(String(current), pct);
    },
    [remember],
  );

  const onEpubLocation = useCallback(
    (cfi: string, pct: number | null, chapter: string, atEnd: boolean) => {
      setPosition({ location: cfi, chapter, atEnd });
      if (pct !== null) setPercent(pct);
      remember(cfi, pct ?? saved?.percent ?? 0);
    },
    [remember, saved?.percent],
  );

  const onReady = useCallback(() => setReady(true), []);
  const onError = useCallback((message: string) => setError(message), []);

  function saveCurrentBookmark() {
    if (!position.location) return;
    const chapterTitle = labelForChapter(position.chapter);
    const label = chapterTitle ?? (page ? `صفحة ${page.current}` : `موضع ${Math.round(percent ?? 0)}٪`);
    toggleBookmark({ ...book, format, location: position.location, label, createdAt: Date.now() });
    setBookmarkState({ bookId: book.id, items: bookmarksFor(book.id) });
  }

  function deleteSavedBookmark(bookmark: ReadingBookmark) {
    removeBookmark(bookmark);
    setBookmarkState({ bookId: book.id, items: bookmarksFor(book.id) });
  }

  function goToBookmark(bookmark: ReadingBookmark) {
    if (bookmark.format === "pdf") pdfRef.current?.goToPage(Number(bookmark.location));
    else epubRef.current?.goTo(bookmark.location);
    setBookmarksOpen(false);
  }

  function openQuote() {
    const selected = epubRef.current?.selectedText().trim();
    if (!selected) {
      setNotice("حدد جملة من الكتاب أولاً، وبعدها اضغط زر الاقتباس.");
      window.setTimeout(() => setNotice(null), 3500);
      return;
    }
    setQuoteText(selected);
    epubRef.current?.clearSelectedText();
  }

  async function reactToChapter(reaction: ReactionId) {
    if (!position.chapter) return;
    setReactionMessage("");
    try {
      const response = await fetch(`/api/books/${book.id}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapterKey: position.chapter, reaction, visitorId: reactionVisitorId() }),
      });
      const result = await response.json() as { counts?: ReactionCounts };
      if (!response.ok || !result.counts) throw new Error("reaction failed");
      setReactionCounts(result.counts);
      rememberReaction(book.id, position.chapter, reaction);
    } catch {
      setReactionMessage("تعذّر حفظ تفاعلك؛ حاول مرة ثانية.");
    }
  }

  async function toggleOfflineCopy() {
    setOfflineMessage("");
    try {
      const cache = await caches.open(OFFLINE_BOOK_CACHE);
      if (offlineState === "saved") {
        await cache.delete(fileUrl);
        setOfflineState("ready");
        setOfflineMessage("انحذفت النسخة المحفوظة من هذا الجهاز.");
        return;
      }
      if (fileSize != null && fileSize > MAX_OFFLINE_BOOK_BYTES) {
        setOfflineMessage("حجم الملف يتجاوز 100 ميغابايت؛ استخدم التحميل واحفظه بتطبيق ملفات الجهاز.");
        return;
      }
      if (fileSize == null) {
        setOfflineMessage("حجم الكتاب غير معروف، لذلك ما حفظناه حتى نتجنب استهلاك مساحة كبيرة.");
        return;
      }
      const estimate = await navigator.storage?.estimate?.();
      if (estimate?.quota && estimate.usage != null && fileSize != null && estimate.quota - estimate.usage < fileSize + 8 * 1024 * 1024) {
        setOfflineMessage("مساحة المتصفح غير كافية لحفظ الكتاب. امسح بعض الملفات المحفوظة أو حمّله مباشرة.");
        return;
      }
      setOfflineState("saving");
      const response = await fetch(fileUrl, { cache: "no-store" });
      if (!response.ok || response.status === 206) throw new Error("download failed");
      const actualSize = Number(response.headers.get("content-length")) || fileSize;
      if (actualSize > MAX_OFFLINE_BOOK_BYTES) throw new Error("too large");
      await cache.put(fileUrl, response);
      const pageCache = await caches.open(OFFLINE_PAGE_CACHE);
      for (const path of [window.location.href, new URL(book.href, window.location.origin).toString()]) {
        try {
          const page = await fetch(path, { cache: "no-store" });
          if (page.ok && (page.headers.get("content-type") || "").includes("text/html")) await pageCache.put(path, page);
        } catch {
          // The book file is still saved even if one of its pages cannot be cached.
        }
      }
      setOfflineState("saved");
      setOfflineMessage("انحفظ الكتاب وصفحته على هذا الجهاز، وتكدر تقراه بدون إنترنت.");
    } catch (error) {
      setOfflineState("ready");
      setOfflineMessage(error instanceof Error && error.message === "too large"
        ? "حجم الملف يتجاوز 100 ميغابايت؛ استخدم التحميل واحفظه بتطبيق ملفات الجهاز."
        : "ما قدر المتصفح يحفظ الملف؛ تحقق من الاتصال أو مساحة الجهاز.");
    }
  }

  const topReacted = Object.entries(reactionCounts)
    .map(([href, counts]) => ({ href, total: Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0) }))
    .sort((a, b) => b.total - a.total)[0];

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
        <button type="button" className="rbtn" onClick={() => setSettingsOpen(true)} aria-label="إعدادات القراءة" title="إعدادات القراءة">
          <Settings2 className="h-5 w-5" aria-hidden="true" />
        </button>
        <button type="button" className="rbtn" onClick={() => setBookmarksOpen(true)} aria-label="العلامات المرجعية" title="العلامات المرجعية">
          <Bookmark className="h-5 w-5" aria-hidden="true" />
        </button>
        {!isPdf && <button type="button" className="rbtn" onClick={openQuote} aria-label="صناعة صورة اقتباس" title="صناعة صورة اقتباس"><Quote className="h-5 w-5" aria-hidden="true" /></button>}
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

      {notice && <div className="absolute left-1/2 top-16 z-10 -translate-x-1/2 rounded-xl border px-4 py-3 text-sm shadow-lg" style={{ background: theme.bg, color: theme.fg, borderColor: theme.line }} role="status">{notice}</div>}

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

      {!isPdf && position.atEnd && position.chapter && (
        <div className="absolute bottom-14 left-2 right-2 z-10 flex flex-col items-center gap-1" dir="rtl">
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border p-1 shadow-lg" style={{ background: theme.bg, borderColor: theme.line }} aria-label="تفاعل مع هذا الفصل">
            {REACTION_OPTIONS.map((reaction) => {
              const count = reactionCounts[position.chapter]?.[reaction.id] ?? 0;
              return (
                <button key={reaction.id} type="button" aria-pressed={pickedReaction === reaction.id} title={reaction.label}
                  className="flex min-h-10 shrink-0 items-center gap-1 rounded-xl px-2 text-xs transition-colors"
                  style={{ background: pickedReaction === reaction.id ? theme.line : "transparent", color: theme.fg }}
                  onClick={() => void reactToChapter(reaction.id)}>
                  <span aria-hidden="true">{reaction.emoji}</span><span>{reaction.label}</span><span className="tabular-nums">{count}</span>
                </button>
              );
            })}
          </div>
          {reactionMessage && <p className="rounded-lg px-2 py-1 text-xs" style={{ background: theme.bg, color: theme.muted }} role="status">{reactionMessage}</p>}
        </div>
      )}

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
              <div>
                <p className="font-semibold">الفهرس</p>
                {topReacted && topReacted.total > 0 && <p className="mt-0.5 max-w-56 truncate text-xs" style={{ color: theme.muted }}>الأكثر تفاعلاً: {labelForChapter(topReacted.href) ?? "فصل"} · {topReacted.total}</p>}
              </div>
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
                    <span className="flex min-w-0 items-center justify-between gap-2"><span className="truncate">{item.label}</span>
                      {Object.values(countsForChapter(item.href)).some((count) => (count ?? 0) > 0) && <span className="shrink-0 text-[10px]" style={{ color: theme.muted }}>{Object.values(countsForChapter(item.href)).reduce((sum, count) => sum + (count ?? 0), 0)} تفاعل</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <button type="button" className="flex-1 bg-black/40" onClick={() => setTocOpen(false)} aria-label="إغلاق الفهرس" />
        </div>
      )}

      <ReaderSettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} prefs={prefs} onChange={updatePrefs} isPdf={isPdf} offlineState={offlineState} offlineMessage={offlineMessage} onToggleOffline={() => void toggleOfflineCopy()} />
      <BookmarkPanel
        open={bookmarksOpen}
        theme={prefs.theme}
        bookmarks={bookmarks}
        canSave={Boolean(position.location)}
        currentLabel={page ? `صفحة ${page.current}` : labelForChapter(position.chapter) ?? (ready ? "الفصل الحالي" : "جاري تحديد الموضع")}
        onClose={() => setBookmarksOpen(false)}
        onAdd={saveCurrentBookmark}
        onRemove={deleteSavedBookmark}
        onGo={goToBookmark}
      />
      {quoteText && <QuoteDialog quote={quoteText} title={book.title} author={book.author} theme={prefs.theme} onClose={() => setQuoteText("")} />}
    </div>
  );
}
