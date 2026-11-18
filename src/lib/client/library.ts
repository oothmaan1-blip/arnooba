"use client";

import { readLocal, writeLocal } from "./local";

export interface BookRef {
  id: number;
  title: string;
  author: string;
  lang: "ar" | "en";
  href: string;
  coverUrl: string | null;
}

export interface ReadingProgress extends BookRef {
  format: "pdf" | "epub";
  readHref: string;
  /** PDF page number or EPUB CFI. */
  location: string;
  percent: number;
  updatedAt: number;
}

export interface ShelfItem extends BookRef {
  addedAt: number;
}

export interface ReadingBookmark extends BookRef {
  format: "pdf" | "epub";
  location: string;
  label: string;
  createdAt: number;
}

export const PROGRESS_KEY = "arnooba:progress:v1";
export const SHELF_KEY = "arnooba:shelf:v1";
export const BOOKMARKS_KEY = "arnooba:bookmarks:v1";
export const READING_TIME_KEY = "arnooba:reading-time:v1";
export const EMPTY_PROGRESS: Record<string, ReadingProgress> = {};
export const EMPTY_SHELF: ShelfItem[] = [];
export const EMPTY_BOOKMARKS: ReadingBookmark[] = [];

const MAX_PROGRESS = 60;

export function getProgress(id: number, format: "pdf" | "epub"): ReadingProgress | undefined {
  return readLocal(PROGRESS_KEY, EMPTY_PROGRESS)[`${id}:${format}`];
}

export function saveProgress(entry: ReadingProgress): void {
  const all = { ...readLocal(PROGRESS_KEY, EMPTY_PROGRESS), [`${entry.id}:${entry.format}`]: entry };
  const kept = Object.entries(all)
    .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_PROGRESS);
  writeLocal(PROGRESS_KEY, Object.fromEntries(kept));
}

export function removeProgress(id: number): void {
  const all = readLocal(PROGRESS_KEY, EMPTY_PROGRESS);
  writeLocal(
    PROGRESS_KEY,
    Object.fromEntries(Object.entries(all).filter(([, p]) => p.id !== id)),
  );
}

/** Most recent first, one entry per book. */
export function recentProgress(all: Record<string, ReadingProgress>): ReadingProgress[] {
  const seen = new Set<number>();
  return Object.values(all)
    .filter((p) => p && typeof p.id === "number")
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

export function bookmarksFor(id: number): ReadingBookmark[] {
  const all = readLocal<unknown>(BOOKMARKS_KEY, EMPTY_BOOKMARKS);
  if (!Array.isArray(all)) return [];
  return all
    .filter((bookmark) => bookmark && bookmark.id === id)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function toggleBookmark(bookmark: ReadingBookmark): boolean {
  const value = readLocal<unknown>(BOOKMARKS_KEY, EMPTY_BOOKMARKS);
  const all = Array.isArray(value) ? value as ReadingBookmark[] : [];
  const exists = all.some((item) => item.id === bookmark.id && item.format === bookmark.format && item.location === bookmark.location);
  const next = exists
    ? all.filter((item) => !(item.id === bookmark.id && item.format === bookmark.format && item.location === bookmark.location))
    : [bookmark, ...all].slice(0, 500);
  writeLocal(BOOKMARKS_KEY, next);
  return !exists;
}

export function removeBookmark(bookmark: ReadingBookmark): void {
  const value = readLocal<unknown>(BOOKMARKS_KEY, EMPTY_BOOKMARKS);
  const all = Array.isArray(value) ? value as ReadingBookmark[] : [];
  writeLocal(
    BOOKMARKS_KEY,
    all.filter((item) => !(item.id === bookmark.id && item.format === bookmark.format && item.location === bookmark.location)),
  );
}

export function readingSeconds(): number {
  const value = readLocal<unknown>(READING_TIME_KEY, 0);
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function addReadingSeconds(seconds: number): void {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  writeLocal(READING_TIME_KEY, readingSeconds() + Math.floor(seconds));
}

export function toggleShelf(book: BookRef): boolean {
  const shelf = readLocal(SHELF_KEY, EMPTY_SHELF);
  const exists = shelf.some((b) => b.id === book.id);
  const next = exists ? shelf.filter((b) => b.id !== book.id) : [{ ...book, addedAt: Date.now() }, ...shelf].slice(0, 500);
  writeLocal(SHELF_KEY, next);
  return !exists;
}
