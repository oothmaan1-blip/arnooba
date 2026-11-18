"use client";

import { X, ZoomIn, ZoomOut, AArrowDown, AArrowUp, CloudDownload, Trash2 } from "lucide-react";
import { FONT_OPTIONS, READER_THEMES, type ReaderFont, type ReaderPrefs, type ReaderTheme, clamp } from "./theme";

export function ReaderSettingsPanel({
  open,
  onClose,
  prefs,
  onChange,
  isPdf,
  offlineState,
  offlineMessage,
  onToggleOffline,
}: {
  open: boolean;
  onClose(): void;
  prefs: ReaderPrefs;
  onChange(patch: Partial<ReaderPrefs>): void;
  isPdf: boolean;
  offlineState: "checking" | "ready" | "saved" | "saving" | "unsupported";
  offlineMessage: string;
  onToggleOffline(): void;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-20 flex items-start justify-center bg-black/45 px-2 pt-16 sm:justify-end sm:px-4" role="dialog" aria-modal="true" aria-label="إعدادات القراءة">
      <section className="max-h-[calc(100dvh-5rem)] w-full max-w-sm overflow-y-auto rounded-2xl border p-4 shadow-2xl" style={{ background: READER_THEMES[prefs.theme].bg, color: READER_THEMES[prefs.theme].fg, borderColor: READER_THEMES[prefs.theme].line }}>
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-bold">إعدادات القراءة</h2>
          <button type="button" className="rbtn" onClick={onClose} aria-label="إغلاق الإعدادات"><X className="h-5 w-5" /></button>
        </header>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-semibold">لون الصفحة</legend>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(READER_THEMES) as [ReaderTheme, (typeof READER_THEMES)[ReaderTheme]][]).map(([id, item]) => (
              <button key={id} type="button" aria-pressed={prefs.theme === id} onClick={() => onChange({ theme: id })}
                className="flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm transition-transform active:scale-[0.98]"
                style={{ background: item.bg, color: item.fg, borderColor: prefs.theme === id ? item.accent : item.line }}>
                <span className="h-4 w-4 rounded-full border" style={{ background: item.accent, borderColor: item.line }} aria-hidden="true" />
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>

        {isPdf ? (
          <section className="mt-5">
            <h3 className="text-sm font-semibold">تكبير صفحات PDF</h3>
            <div className="mt-2 flex items-center gap-3">
              <button type="button" className="rbtn border" style={{ borderColor: READER_THEMES[prefs.theme].line }} onClick={() => onChange({ zoom: clamp(prefs.zoom - 0.15, 0.5, 3) })} aria-label="تصغير PDF"><ZoomOut className="h-5 w-5" /></button>
              <span className="min-w-14 text-center text-sm">{Math.round(prefs.zoom * 100)}٪</span>
              <button type="button" className="rbtn border" style={{ borderColor: READER_THEMES[prefs.theme].line }} onClick={() => onChange({ zoom: clamp(prefs.zoom + 0.15, 0.5, 3) })} aria-label="تكبير PDF"><ZoomIn className="h-5 w-5" /></button>
            </div>
            <p className="mt-3 text-xs leading-6" style={{ color: READER_THEMES[prefs.theme].muted }}>تغيير الخط والمسافات متاح في كتب EPUB، لأن صفحات PDF صور ثابتة.</p>
          </section>
        ) : (
          <>
            <section className="mt-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">حجم الخط</h3>
                <span className="text-xs" style={{ color: READER_THEMES[prefs.theme].muted }}>{prefs.fontScale}٪</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <button type="button" className="rbtn border" style={{ borderColor: READER_THEMES[prefs.theme].line }} onClick={() => onChange({ fontScale: clamp(prefs.fontScale - 10, 70, 220) })} aria-label="تصغير الخط"><AArrowDown className="h-5 w-5" /></button>
                <input className="w-full accent-current" type="range" min="70" max="220" step="5" value={prefs.fontScale} onChange={(event) => onChange({ fontScale: Number(event.target.value) })} aria-label="حجم الخط" />
                <button type="button" className="rbtn border" style={{ borderColor: READER_THEMES[prefs.theme].line }} onClick={() => onChange({ fontScale: clamp(prefs.fontScale + 10, 70, 220) })} aria-label="تكبير الخط"><AArrowUp className="h-5 w-5" /></button>
              </div>
            </section>

            <label className="mt-4 block text-sm font-semibold" htmlFor="reader-font">نوع الخط
              <select id="reader-font" className="input mt-2" value={prefs.font} onChange={(event) => onChange({ font: event.target.value as ReaderFont })}>
                {Object.entries(FONT_OPTIONS).map(([id, font]) => <option key={id} value={id}>{font.label}</option>)}
              </select>
            </label>
            <p className="mt-1 text-xs leading-5" style={{ color: READER_THEMES[prefs.theme].muted }}>خطوط أرنوبة وAmiri وCairo وTajawal مضمّنة وتعمل دون تنزيل من مواقع خارجية.</p>

            <label className="mt-4 block text-sm font-semibold" htmlFor="reader-line-height">تباعد الأسطر
              <select id="reader-line-height" className="input mt-2" value={prefs.lineHeight} onChange={(event) => onChange({ lineHeight: Number(event.target.value) })}>
                <option value="1.6">مضغوط</option><option value="1.8">مريح</option><option value="2">واسع</option><option value="2.2">واسع جداً</option>
              </select>
            </label>

            <label className="mt-4 block text-sm font-semibold" htmlFor="reader-margin">هوامش الصفحة
              <select id="reader-margin" className="input mt-2" value={prefs.pageMargin} onChange={(event) => onChange({ pageMargin: Number(event.target.value) })}>
                <option value="1">ضيقة</option><option value="3">متوسطة</option><option value="5">واسعة</option><option value="7">واسعة جداً</option>
              </select>
            </label>
          </>
        )}

        <section className="mt-5 border-t pt-4" style={{ borderColor: READER_THEMES[prefs.theme].line }}>
          <h3 className="text-sm font-semibold">القراءة بدون إنترنت</h3>
          <p className="mt-1 text-xs leading-6" style={{ color: READER_THEMES[prefs.theme].muted }}>احفظ ملف هذا الكتاب على الجهاز لفتحه لاحقاً بدون اتصال. النسخ الكبيرة يمكن تحميلها من زر التحميل.</p>
          <button type="button" className="btn-secondary mt-3 w-full" disabled={offlineState === "checking" || offlineState === "saving" || offlineState === "unsupported"} onClick={onToggleOffline}>
            {offlineState === "saved" ? <Trash2 className="h-4 w-4" aria-hidden="true" /> : <CloudDownload className="h-4 w-4" aria-hidden="true" />}
            {offlineState === "checking" ? "جارٍ التحقق…" : offlineState === "saving" ? "جارٍ الحفظ…" : offlineState === "unsupported" ? "غير متاح في هذا المتصفح" : offlineState === "saved" ? "إزالة النسخة المحفوظة" : "احفظ هذا الكتاب"}
          </button>
          {offlineMessage && <p className="mt-2 text-xs" role="status" style={{ color: READER_THEMES[prefs.theme].muted }}>{offlineMessage}</p>}
        </section>
      </section>
    </div>
  );
}
