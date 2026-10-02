"use client";

// Continuous-scroll PDF viewer on top of pdf.js. Only pages near the viewport
// keep a canvas, so long books stay light on memory.
import { useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import type { ReaderTheme } from "./theme";

export interface PdfHandle {
  goToPage(page: number): void;
  /** Moves relative to the current page; safe to call several times quickly. */
  step(delta: number): void;
}

const ASSETS = "/pdfjs/";
const MAX_WIDTH = 920;

interface Props {
  url: string;
  initialPage: number;
  zoom: number;
  theme: ReaderTheme;
  handleRef: RefObject<PdfHandle | null>;
  onReady(total: number): void;
  onPage(page: number, total: number): void;
  onLoadProgress(ratio: number): void;
  onError(message: string): void;
}

export default function PdfView({ url, initialPage, zoom, theme, handleRef, ...events }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [ratio, setRatio] = useState(1.414);
  const [fitWidth, setFitWidth] = useState(0);
  const currentPage = useRef(initialPage);
  const restored = useRef(false);

  const ready = useEffectEvent((total: number) => events.onReady(total));
  const loadProgress = useEffectEvent((r: number) => events.onLoadProgress(r));
  const fail = useEffectEvent((message: string) => events.onError(message));
  const reportPage = useEffectEvent((page: number, total: number) => events.onPage(page, total));

  // Load the document.
  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `${ASSETS}pdf.worker.min.mjs`;
        const task = pdfjs.getDocument({
          url,
          cMapUrl: `${ASSETS}cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${ASSETS}standard_fonts/`,
          wasmUrl: `${ASSETS}wasm/`,
          iccUrl: `${ASSETS}iccs/`,
        });
        task.onProgress = ({ loaded: done, total }: { loaded: number; total: number }) => {
          if (total) loadProgress(done / total);
        };
        loaded = await task.promise;
        if (cancelled) return;
        const first = await loaded.getPage(1);
        const viewport = first.getViewport({ scale: 1 });
        setRatio(viewport.height / viewport.width);
        setDoc(loaded);
        ready(loaded.numPages);
      } catch (err) {
        if (!cancelled) {
          console.error(err);
          fail("تعذّر فتح ملف PDF.");
        }
      }
    })();
    return () => {
      cancelled = true;
      void loaded?.loadingTask.destroy();
    };
  }, [url]);

  // Track the available width.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setFitWidth(Math.min(el.clientWidth - 24, MAX_WIDTH));
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const pageWidth = Math.max(120, Math.round(fitWidth * zoom));
  const pageHeight = Math.round(pageWidth * ratio);

  // Render pages that come near the viewport; drop the ones far away.
  useEffect(() => {
    const root = scrollRef.current;
    if (!doc || !root || fitWidth <= 0) return;
    const rendered = new Map<number, RenderTask | null>();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    async function draw(el: HTMLElement, pageNumber: number) {
      if (rendered.has(pageNumber) || !doc) return;
      rendered.set(pageNumber, null);
      const page = await doc.getPage(pageNumber);
      if (!rendered.has(pageNumber)) return;
      const base = page.getViewport({ scale: 1 });
      const cssScale = pageWidth / base.width;
      el.style.height = `${Math.round(base.height * cssScale)}px`;
      const viewport = page.getViewport({ scale: cssScale * dpr });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.className = "block h-full w-full";
      el.replaceChildren(canvas);
      const task = page.render({ canvas, viewport });
      rendered.set(pageNumber, task);
      try {
        await task.promise;
      } catch {
        // cancelled because the page scrolled away
      }
    }

    function release(el: HTMLElement, pageNumber: number) {
      if (!rendered.has(pageNumber)) return;
      rendered.get(pageNumber)?.cancel();
      rendered.delete(pageNumber);
      el.replaceChildren();
    }

    const pages = Array.from(root.querySelectorAll<HTMLElement>("[data-page]"));
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          const n = Number(el.dataset.page);
          if (entry.isIntersecting) void draw(el, n);
          else release(el, n);
        }
      },
      { root, rootMargin: "1600px 0px" },
    );
    pages.forEach((el) => observer.observe(el));

    const scrollToPage = (n: number) => {
      const page = Math.min(pages.length, Math.max(1, n));
      const target = pages[page - 1];
      if (!target) return;
      currentPage.current = page;
      root.scrollTop = target.offsetTop - 12;
    };
    handleRef.current = {
      goToPage: scrollToPage,
      step: (delta) => scrollToPage(currentPage.current + delta),
    };
    // Keep the reader on the same page after zooming or resizing.
    scrollToPage(restored.current ? currentPage.current : initialPage);
    restored.current = true;

    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const probe = root.scrollTop + root.clientHeight * 0.35;
        let lo = 0;
        let hi = pages.length - 1;
        let found = 0;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          if (pages[mid].offsetTop <= probe) {
            found = mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        currentPage.current = found + 1;
        reportPage(found + 1, pages.length);
      });
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      observer.disconnect();
      root.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
      for (const task of rendered.values()) task?.cancel();
      rendered.clear();
      pages.forEach((el) => el.replaceChildren());
    };
  }, [doc, fitWidth, pageWidth, initialPage, handleRef]);

  return (
    <div ref={scrollRef} className={`pdf-scroll pdf-${theme} h-full overflow-y-auto overscroll-contain`} tabIndex={0} aria-label="صفحات الكتاب">
      <div className="relative py-4">
        {doc &&
          fitWidth > 0 &&
          Array.from({ length: doc.numPages }, (_, i) => (
            <div
              key={i}
              data-page={i + 1}
              className="pdf-page mx-auto mb-4 overflow-hidden bg-white shadow-md"
              style={{ width: pageWidth, height: pageHeight }}
              aria-label={`صفحة ${i + 1}`}
            />
          ))}
      </div>
    </div>
  );
}
