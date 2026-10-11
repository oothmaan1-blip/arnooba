"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/site";

type Suggestion = { id: number; title: string; author: string; href: string; lang: "ar" | "en" };

export function SearchForm({
  defaultValue,
  large = false,
  className,
  id = "q",
}: {
  defaultValue?: string;
  large?: boolean;
  className?: string;
  id?: string;
}) {
  const [query, setQuery] = useState(defaultValue ?? "");
  const [result, setResult] = useState<{ query: string; suggestions: Suggestion[] } | null>(null);
  const [focused, setFocused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const listId = `${id}-suggestions`;

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    request.current?.abort();
    const q = query.trim();
    if ([...q].length < 2) return;

    timer.current = setTimeout(async () => {
      const controller = new AbortController();
      request.current = controller;
      try {
        const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (response.ok) {
          const data = (await response.json()) as { suggestions: Suggestion[] };
          setResult({ query: q, suggestions: data.suggestions });
        } else {
          setResult({ query: q, suggestions: [] });
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setResult({ query: q, suggestions: [] });
        }
      }
    }, 250);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      request.current?.abort();
    };
  }, [query]);

  const suggestions = result?.query === query.trim() ? result.suggestions : [];
  const showSuggestions = focused && [...query.trim()].length >= 2 && suggestions.length > 0;

  return (
    <form action="/search" role="search" className={cn("relative w-full", className)}>
      <label htmlFor={id} className="sr-only">ابحث عن كتاب أو مؤلف</label>
      <Search
        className={cn("pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted", large ? "h-5 w-5" : "h-4 w-4")}
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setFocused(true);
        }}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) {
            blurTimer.current = setTimeout(() => setFocused(false), 150);
          }
        }}
        placeholder="ابحث عن كتاب أو مؤلف…"
        maxLength={200}
        autoComplete="off"
        enterKeyHint="search"
        className={cn("input", large ? "h-14 rounded-2xl ps-11 text-base shadow-sm" : "h-10 ps-10")}
      />
      {showSuggestions && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          <ul id={listId} aria-label="اقتراحات الكتب" className="max-h-80 overflow-y-auto py-1">
            {suggestions.map((book) => (
              <li key={book.id}>
                <Link
                  href={book.href}
                  onClick={() => {
                    if (blurTimer.current) clearTimeout(blurTimer.current);
                    setFocused(false);
                  }}
                  className="block px-4 py-3 hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
                >
                  <span dir="auto" className="block truncate text-sm font-semibold">{book.title}</span>
                  <span dir="auto" className="mt-0.5 block truncate text-xs text-muted">{book.author || (book.lang === "ar" ? "عربي" : "English")}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
