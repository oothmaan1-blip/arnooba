import { cache } from "react";
import { getBook } from "./books";
import { parseIdParam } from "./text";

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Resolves "/book/12-title" style params; deduped across metadata + page. */
export const bookFromParam = cache(async (param: string) => {
  const id = parseIdParam(safeDecode(param));
  return id ? getBook(id) : null;
});

export function sameSlug(param: string, expected: string): boolean {
  return safeDecode(param) === safeDecode(expected);
}
