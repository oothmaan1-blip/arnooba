"use client";

// Paginated EPUB viewer on top of epub.js. Book scripts never run: the
// content iframe is sandboxed without allow-scripts.
import { useEffect, useEffectEvent, useRef, type RefObject } from "react";
import type { Book as EpubBook, Location, NavItem, Rendition } from "epubjs";
import { READER_THEMES, type ReaderTheme } from "./theme";

export interface EpubHandle {
  next(): void;
  prev(): void;
  goTo(href: string): void;
}

export interface TocItem {
  label: string;
  href: string;
  depth: number;
}

interface Props {
  url: string;
  lang: "ar" | "en";
  initialCfi: string | null;
  theme: ReaderTheme;
  fontScale: number;
  handleRef: RefObject<EpubHandle | null>;
  onReady(): void;
  onLocation(cfi: string, percent: number | null): void;
  onToc(items: TocItem[]): void;
  onLoadProgress(ratio: number): void;
  onError(message: string): void;
}

async function fetchWithProgress(url: string, onProgress: (ratio: number) => void): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    if (total) onProgress(Math.min(1, loaded / total));
  }
  const data = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return data.buffer;
}

/**
 * Table-of-contents links are relative to the navigation file, but epub.js
 * looks chapters up by their path in the package. They only agree when the
 * two sit in one folder (Gutenberg); Hindawi keeps nav.xhtml in a subfolder,
 * so "../Content/chapter-1-2.xhtml" must become "Content/chapter-1-2.xhtml".
 */
function chapterHref(href: string, navPath: string | undefined, known: (href: string) => boolean): string {
  if (!navPath || known(href)) return href;
  try {
    const url = new URL(href, `https://book.invalid/${navPath}`);
    const resolved = decodeURIComponent(url.pathname.slice(1)) + url.hash;
    return known(resolved) ? resolved : href;
  } catch {
    return href;
  }
}

function flatten(items: NavItem[], resolve: (href: string) => string, depth = 0, out: TocItem[] = []): TocItem[] {
  for (const item of items) {
    const label = item.label.replace(/\s+/g, " ").trim();
    if (label) out.push({ label, href: resolve(item.href), depth });
    if (item.subitems?.length) flatten(item.subitems, resolve, depth + 1, out);
  }
  return out;
}

/**
 * A page width that is a whole number of device pixels. epub.js turns pages
 * with relative scrolls; on 125%/150% screens each scroll snaps to the device
 * pixel grid, the error accumulates, and after some pages text gets cut off.
 */
function crispWidth(available: number): number {
  const dpr = window.devicePixelRatio || 1;
  const max = Math.floor(available);
  for (let width = max; width > max - 24 && width > 0; width--) {
    const device = width * dpr;
    if (Math.abs(device - Math.round(device)) < 0.001) return width;
  }
  return max;
}

function registerThemes(rendition: Rendition, lang: "ar" | "en") {
  for (const [name, t] of Object.entries(READER_THEMES)) {
    rendition.themes.register(name, {
      body: {
        color: `${t.fg} !important`,
        background: `${t.bg} !important`,
        "line-height": lang === "ar" ? "1.95 !important" : "1.65 !important",
      },
      "p, li, blockquote, dd": { "line-height": "inherit !important" },
      "body *": { color: "inherit !important", "background-color": "transparent !important" },
      a: { color: `${t.accent} !important` },
      img: { "max-width": "100% !important", height: "auto !important" },
    });
  }
}

export default function EpubView({ url, lang, initialCfi, theme, fontScale, handleRef, ...events }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<Rendition | null>(null);
  const rtl = lang === "ar";

  const initialLook = useEffectEvent(() => ({ theme, fontScale }));
  const ready = useEffectEvent(() => events.onReady());
  const located = useEffectEvent((cfi: string, percent: number | null) => events.onLocation(cfi, percent));
  const gotToc = useEffectEvent((items: TocItem[]) => events.onToc(items));
  const loadProgress = useEffectEvent((r: number) => events.onLoadProgress(r));
  const fail = useEffectEvent((message: string) => events.onError(message));

  useEffect(() => {
    let cancelled = false;
    let book: EpubBook | null = null;
    const host = hostRef.current;
    if (!host) return;

    let turning = false;
    // Percentages are only meaningful once every location has been generated.
    let locationsReady = false;
    let displayed = false;
    let lastSize = "";
    const turn = async (forward: boolean) => {
      const r = renditionRef.current;
      if (!r || turning) return;
      turning = true;
      try {
        const scroller = () => (r as unknown as { manager?: { container?: HTMLElement } }).manager?.container;
        const before = (r.currentLocation() as unknown as Location | undefined)?.start;
        const scrollBefore = scroller()?.scrollLeft;
        await (forward ? r.next() : r.prev());
        const after = (r.currentLocation() as unknown as Location | undefined)?.start;
        // epub.js can stall on the edge of a right-to-left section; step to the neighbour.
        if (before && after && before.href === after.href && scroller()?.scrollLeft === scrollBefore && before.cfi === after.cfi) {
          const section = r.book.spine.get(before.href) as unknown as { next?(): { href: string } | undefined; prev?(): { href: string } | undefined };
          const target = forward ? section?.next?.() : section?.prev?.();
          if (target) await r.display(target.href);
        }
      } finally {
        turning = false;
      }
    };
    // Arrow keys follow the book's direction: ← moves forward in Arabic.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") turn(rtl);
      else if (e.key === "ArrowRight") turn(!rtl);
    };
    let touchX = 0;
    let touchY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchX = e.changedTouches[0]?.screenX ?? 0;
      touchY = e.changedTouches[0]?.screenY ?? 0;
    };
    const onTouchEnd = (e: TouchEvent) => {
      const dx = (e.changedTouches[0]?.screenX ?? 0) - touchX;
      const dy = (e.changedTouches[0]?.screenY ?? 0) - touchY;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      turn(rtl ? dx > 0 : dx < 0);
    };

    (async () => {
      try {
        const data = await fetchWithProgress(url, loadProgress);
        if (cancelled) return;
        const { default: ePub } = await import("epubjs");
        book = ePub(data);
        // Whole pixels: with a fractional width (zoomed or high-DPI screens) the
        // columns drift away from epub.js's page offsets and pages get cut.
        const rendition = book.renderTo(host, {
          width: crispWidth(host.clientWidth),
          height: Math.floor(host.clientHeight),
          flow: "paginated",
          spread: "none",
          allowScriptedContent: false,
          defaultDirection: rtl ? "rtl" : "ltr",
        });
        renditionRef.current = rendition;
        registerThemes(rendition, lang);
        const look = initialLook();
        rendition.themes.select(look.theme);
        rendition.themes.fontSize(`${look.fontScale}%`);

        rendition.on("relocated", (location: Location) => {
          const cfi = location.start.cfi;
          const percent = book && locationsReady ? book.locations.percentageFromCfi(cfi) * 100 : null;
          located(cfi, percent);
        });
        rendition.on("keyup", onKey);
        rendition.on("touchstart", onTouchStart);
        rendition.on("touchend", onTouchEnd);

        try {
          await rendition.display(initialCfi ?? undefined);
        } catch {
          await rendition.display();
        }
        if (cancelled) return;
        displayed = true;
        lastSize = `${crispWidth(host.clientWidth)}x${Math.floor(host.clientHeight)}`;
        ready();

        const nav = await book.loaded.navigation;
        const opened = book;
        const packaging = opened.packaging as unknown as { navPath?: string; ncxPath?: string } | undefined;
        const navPath = packaging?.navPath || packaging?.ncxPath;
        const known = (href: string) => Boolean(opened.spine.get(href));
        if (!cancelled) gotToc(flatten(nav.toc, (href) => chapterHref(href, navPath, known)));

        // Page percentages need a pass over the whole book; do it last.
        await book.locations.generate(1200);
        locationsReady = true;
        if (cancelled) return;
        const current = rendition.currentLocation() as unknown as Location | undefined;
        if (current?.start?.cfi) {
          located(current.start.cfi, book.locations.percentageFromCfi(current.start.cfi) * 100);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          fail("تعذّر فتح الكتاب.");
        }
      }
    })();

    window.addEventListener("keyup", onKey);
    handleRef.current = {
      next: () => void turn(true),
      prev: () => void turn(false),
      goTo: (href) => void renditionRef.current?.display(href),
    };

    let resizeTimer: ReturnType<typeof setTimeout> | undefined;
    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        // Only once the first page is on screen: before that epub.js has no stage.
        if (!displayed) return;
        const width = crispWidth(host.clientWidth);
        const height = Math.floor(host.clientHeight);
        if (`${width}x${height}` === lastSize) return;
        lastSize = `${width}x${height}`;
        renditionRef.current?.resize(width, height);
      }, 200);
    });
    observer.observe(host);

    return () => {
      cancelled = true;
      observer.disconnect();
      clearTimeout(resizeTimer);
      window.removeEventListener("keyup", onKey);
      handleRef.current = null;
      renditionRef.current = null;
      book?.destroy();
    };
  }, [url, lang, rtl, initialCfi, handleRef]);

  useEffect(() => {
    renditionRef.current?.themes.select(theme);
  }, [theme]);

  useEffect(() => {
    renditionRef.current?.themes.fontSize(`${fontScale}%`);
  }, [fontScale]);

  return (
    <div className="mx-auto h-full w-full max-w-3xl px-2 sm:px-6">
      <div ref={hostRef} className="flex h-full w-full justify-center overflow-hidden" />
    </div>
  );
}
