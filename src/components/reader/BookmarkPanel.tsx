"use client";

import { BookmarkPlus, Trash2, X } from "lucide-react";
import type { ReadingBookmark } from "@/lib/client/library";
import type { ReaderTheme } from "./theme";
import { READER_THEMES } from "./theme";

export function BookmarkPanel({
  open,
  theme,
  bookmarks,
  canSave,
  currentLabel,
  onClose,
  onAdd,
  onRemove,
  onGo,
}: {
  open: boolean;
  theme: ReaderTheme;
  bookmarks: ReadingBookmark[];
  canSave: boolean;
  currentLabel: string;
  onClose(): void;
  onAdd(): void;
  onRemove(bookmark: ReadingBookmark): void;
  onGo(bookmark: ReadingBookmark): void;
}) {
  if (!open) return null;
  const colors = READER_THEMES[theme];
  return (
    <div className="absolute inset-0 z-20 flex bg-black/45" role="dialog" aria-modal="true" aria-label="العلامات المرجعية">
      <section className="flex h-full w-full max-w-sm flex-col shadow-2xl" style={{ background: colors.bg, color: colors.fg }}>
        <header className="flex h-14 shrink-0 items-center justify-between border-b px-4" style={{ borderColor: colors.line }}>
          <h2 className="font-bold">علاماتي المرجعية</h2>
          <button type="button" className="rbtn" onClick={onClose} aria-label="إغلاق العلامات"><X className="h-5 w-5" /></button>
        </header>
        <div className="border-b p-4" style={{ borderColor: colors.line }}>
          <p className="mb-3 text-sm" style={{ color: colors.muted }}>الموضع الحالي: {currentLabel}</p>
          <button type="button" className="btn-primary w-full" disabled={!canSave} onClick={onAdd}>
            <BookmarkPlus className="h-4 w-4" aria-hidden="true" /> احفظ هذا الموضع
          </button>
        </div>
        {bookmarks.length ? (
          <ul className="flex-1 divide-y overflow-y-auto" style={{ borderColor: colors.line }}>
            {bookmarks.map((bookmark) => (
              <li key={`${bookmark.format}:${bookmark.location}`} className="flex items-center gap-2 p-3">
                <button type="button" className="min-h-11 min-w-0 flex-1 rounded-lg px-2 text-start text-sm hover:bg-black/5" onClick={() => onGo(bookmark)}>
                  <span className="block font-semibold">{bookmark.label}</span>
                  <span className="mt-1 block text-xs" style={{ color: colors.muted }}>{new Date(bookmark.createdAt).toLocaleDateString("ar-IQ")}</span>
                </button>
                <button type="button" className="rbtn" onClick={() => onRemove(bookmark)} aria-label={`حذف علامة ${bookmark.label}`}><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-center text-sm" style={{ color: colors.muted }}>ما عندك علامات لهذا الكتاب بعد.</p>
        )}
      </section>
      <button type="button" className="flex-1" onClick={onClose} aria-label="إغلاق العلامات المرجعية" />
    </div>
  );
}
