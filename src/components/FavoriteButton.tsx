"use client";

import { Heart } from "lucide-react";
import { EMPTY_SHELF, SHELF_KEY, toggleShelf, type BookRef } from "@/lib/client/library";
import { useLocalJSON } from "@/lib/client/local";
import { cn } from "@/lib/site";

export function FavoriteButton({ book }: { book: BookRef }) {
  const { value } = useLocalJSON(SHELF_KEY, EMPTY_SHELF);
  const saved = value.some((b) => b.id === book.id);
  return (
    <button
      type="button"
      onClick={() => toggleShelf(book)}
      aria-pressed={saved}
      className={cn("btn-secondary", saved && "border-accent text-accent")}
    >
      <Heart className={cn("h-4 w-4", saved && "fill-current")} aria-hidden="true" />
      {saved ? "في رفّي" : "أضف إلى رفّي"}
    </button>
  );
}
