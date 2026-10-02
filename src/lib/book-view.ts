// Serializable shapes handed from server components to UI (and client) code.
import type { Book } from "./books";
import type { CategoryId, Lang } from "./categories";
import { bookPath, readPath } from "./paths";
import { publicUrl } from "./storage";

export interface BookCardData {
  id: number;
  title: string;
  author: string;
  lang: Lang;
  category: CategoryId;
  href: string;
  readHref: string;
  coverUrl: string | null;
}

export function toCard(book: Book): BookCardData {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    lang: book.lang,
    category: book.category,
    href: bookPath(book),
    readHref: readPath(book),
    coverUrl: book.coverKey ? publicUrl(book.coverKey) : null,
  };
}
