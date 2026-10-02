import type { Book } from "../books";

export type ImportResult =
  | { status: "imported"; book: Book }
  | { status: "exists"; book: Book }
  | { status: "skipped"; reason: string };
