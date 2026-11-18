"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Share2, X } from "lucide-react";
import mark from "../../../assets/brand/arnooba-mark.png";
import type { ReaderTheme } from "./theme";
import { READER_THEMES } from "./theme";

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n+/)) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      if (!word) continue;
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
  }
  return lines;
}

function drawQuote(canvas: HTMLCanvasElement, quote: string, title: string, author: string, theme: ReaderTheme, brandImage: HTMLImageElement | null) {
  const colors = READER_THEMES[theme];
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = 1080;
  canvas.height = 1350;
  const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
  gradient.addColorStop(0, colors.bg);
  gradient.addColorStop(1, colors.line);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = colors.bg;
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(114, 70); ctx.lineTo(966, 70); ctx.arcTo(1010, 70, 1010, 114, 44);
  ctx.lineTo(1010, 1236); ctx.arcTo(1010, 1280, 966, 1280, 44);
  ctx.lineTo(114, 1280); ctx.arcTo(70, 1280, 70, 1236, 44);
  ctx.lineTo(70, 114); ctx.arcTo(70, 70, 114, 70, 44);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillStyle = colors.accent;
  ctx.font = '700 48px "IBM Plex Sans Arabic", "Noto Sans Arabic", sans-serif';
  ctx.fillText("أرنوبة", 930, 170);
  ctx.fillStyle = colors.muted;
  ctx.font = '400 24px "IBM Plex Sans Arabic", "Noto Sans Arabic", sans-serif';
  ctx.fillText("مساحة صغيرة لحكاية تبقى", 930, 215);
  if (brandImage?.complete && brandImage.naturalWidth) ctx.drawImage(brandImage, 100, 95, 150, 150);

  ctx.fillStyle = colors.accent;
  ctx.font = '700 100px Georgia, serif';
  ctx.fillText("❞", 900, 380);
  ctx.fillStyle = colors.fg;
  ctx.font = '500 46px "IBM Plex Sans Arabic", "Noto Naskh Arabic", serif';
  const lines = wrapText(ctx, quote.slice(0, 420), 800);
  const lineHeight = 74;
  const textTop = Math.max(470, 630 - (lines.length * lineHeight) / 2);
  lines.forEach((line, index) => ctx.fillText(line, 900, textTop + index * lineHeight));

  ctx.fillStyle = colors.accent;
  ctx.fillRect(180, 1020, 720, 2);
  ctx.fillStyle = colors.fg;
  ctx.font = '700 30px "IBM Plex Sans Arabic", "Noto Sans Arabic", sans-serif';
  ctx.fillText(title.slice(0, 90), 900, 1090);
  if (author) {
    ctx.fillStyle = colors.muted;
    ctx.font = '400 25px "IBM Plex Sans Arabic", "Noto Sans Arabic", sans-serif';
    ctx.fillText(author.slice(0, 90), 900, 1135);
  }
  ctx.fillStyle = colors.muted;
  ctx.font = '400 20px "IBM Plex Sans Arabic", "Noto Sans Arabic", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("أرنوبة · كتب عربية وإنكليزية", 540, 1210);
}

export function QuoteDialog({
  quote,
  title,
  author,
  theme,
  onClose,
}: {
  quote: string;
  title: string;
  author: string;
  theme: ReaderTheme;
  onClose(): void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [text, setText] = useState(quote);
  const [message, setMessage] = useState("");
  const [renderedKey, setRenderedKey] = useState("");
  const colors = READER_THEMES[theme];
  const renderKey = JSON.stringify([text, title, author, theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => { if (!cancelled) { drawQuote(canvas, text, title, author, theme, image); setRenderedKey(renderKey); } };
    image.onerror = () => { if (!cancelled) { drawQuote(canvas, text, title, author, theme, null); setRenderedKey(renderKey); } };
    image.src = mark.src;
    return () => { cancelled = true; };
  }, [renderKey, text, title, author, theme]);

  async function createImage(): Promise<Blob | null> {
    const canvas = canvasRef.current;
    if (!canvas || renderedKey !== renderKey) return null;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) {
      setMessage("تعذّر إنشاء الصورة على هذا الجهاز.");
      return null;
    }
    return blob;
  }

  function download(blob: Blob) {
    const link = document.createElement("a");
    link.download = "arnooba-quote.png";
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async function shareQuote() {
    const blob = await createImage();
    if (!blob) return;
    const file = new File([blob], "arnooba-quote.png", { type: "image/png" });
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ files: [file], title: `اقتباس من ${title}` });
        return;
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
    }
    download(blob);
    setMessage("نزلنا الصورة؛ تگدر هسه تشاركها من جهازك.");
  }

  async function downloadQuote() {
    const blob = await createImage();
    if (blob) download(blob);
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 p-3" role="dialog" aria-modal="true" aria-label="إنشاء صورة اقتباس">
        <section className="flex max-h-[94dvh] w-full max-w-lg flex-col overflow-y-auto rounded-2xl border p-4 shadow-2xl sm:p-5" style={{ background: colors.bg, color: colors.fg, borderColor: colors.line }}>
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-bold">اقتباس مميز</h2>
          <button type="button" className="rbtn" onClick={onClose} aria-label="إغلاق"><X className="h-5 w-5" /></button>
        </header>
        <label className="mt-3 text-sm font-semibold" htmlFor="quote-text">النص اللي تريد تشاركه</label>
        <textarea id="quote-text" className="input mt-2 min-h-24 resize-y leading-7" maxLength={420} value={text} onChange={(event) => setText(event.target.value)} />
        <canvas ref={canvasRef} className="mt-4 h-auto max-h-[42dvh] w-full rounded-xl border border-line object-contain" aria-label="معاينة صورة الاقتباس" />
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="btn-primary flex-1" disabled={!text.trim() || renderedKey !== renderKey} onClick={() => void shareQuote()}><Share2 className="h-4 w-4" /> مشاركة الصورة</button>
          <button type="button" className="btn-secondary" disabled={!text.trim() || renderedKey !== renderKey} onClick={() => void downloadQuote()}><Download className="h-4 w-4" /><span className="sr-only">تنزيل الصورة</span></button>
        </div>
        <p className="mt-2 text-xs text-muted" aria-live="polite">{message}</p>
      </section>
    </div>
  );
}
