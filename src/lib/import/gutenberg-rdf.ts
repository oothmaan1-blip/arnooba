// Reads a book's official RDF record from gutenberg.org (the same metadata
// Gutendex serves, straight from the source). Pure parsing lives here so tests
// can load it directly; it maps to the Gutendex shape the importer expects.
import type { GutendexBook, Person } from "./gutenberg-rules";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function decode(text: string): string {
  return text
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
      if (entity[0] === "#") {
        const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return ENTITIES[entity.toLowerCase()] ?? match;
    })
    .trim();
}

function blocks(xml: string, tag: string): string[] {
  return [...xml.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "g"))].map((m) => m[1]);
}

function first(xml: string, tag: string): string | undefined {
  const value = blocks(xml, tag)[0];
  return value === undefined ? undefined : decode(value);
}

function values(xml: string, tag: string): string[] {
  return blocks(xml, tag)
    .map((block) => first(block, "rdf:value"))
    .filter((v): v is string => Boolean(v));
}

function agents(xml: string, tag: string): Person[] {
  return blocks(xml, tag).flatMap((block) =>
    blocks(block, "pgterms:agent").map((agent) => {
      const year = (field: string) => {
        const raw = first(agent, field);
        return raw && /^-?\d+$/.test(raw) ? Number(raw) : null;
      };
      return { name: first(agent, "pgterms:name") ?? "", birth_year: year("pgterms:birthdate"), death_year: year("pgterms:deathdate") };
    }),
  );
}

export function parseGutenbergRdf(id: number, xml: string): GutendexBook {
  const ebook = blocks(xml, "pgterms:ebook")[0] ?? xml;
  const files = [...ebook.matchAll(/<pgterms:file rdf:about="([^"]+)"/g)].map((m) => m[1]);
  const formats: Record<string, string> = {};
  const epub = files.find((f) => f.endsWith(`/ebooks/${id}.epub3.images`)) ?? files.find((f) => f.endsWith(`/ebooks/${id}.epub.images`));
  if (epub) formats["application/epub+zip"] = epub;
  const cover = files.find((f) => /cover\.medium\.jpg$/.test(f));
  if (cover) formats["image/jpeg"] = cover;
  const rights = first(ebook, "dcterms:rights") ?? "";

  return {
    id,
    title: first(ebook, "dcterms:title") ?? `Gutenberg #${id}`,
    authors: agents(ebook, "dcterms:creator"),
    translators: agents(ebook, "marcrel:trl"),
    editors: agents(ebook, "marcrel:edt"),
    summaries: blocks(ebook, "pgterms:marc520").map(decode),
    subjects: values(ebook, "dcterms:subject"),
    bookshelves: values(ebook, "pgterms:bookshelf"),
    languages: values(ebook, "dcterms:language"),
    copyright: /^Public domain in the USA\.?$/i.test(rights) ? false : rights ? true : null,
    media_type: values(ebook, "dcterms:type")[0] ?? "",
    formats,
    download_count: Number(first(ebook, "pgterms:downloads")) || 0,
  };
}
