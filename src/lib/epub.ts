// Reads metadata and an approximate text length from an EPUB on the server
// (used when importing). Admin uploads are inspected in the browser instead.
import JSZip from "jszip";

export interface EpubInfo {
  title: string;
  creator: string;
  language: string;
  description: string;
  textLength: number;
}

const MAX_SPINE_FILES = 600;
const MAX_TOTAL_CHARS = 60_000_000;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1] === "x" || entity[1] === "X" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function firstElement(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
  return match ? decodeEntities(match[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim() : "";
}

function attribute(tag: string, name: string): string | undefined {
  return new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i").exec(tag)?.[1] ?? new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, "i").exec(tag)?.[1];
}

function resolvePath(base: string, href: string): string {
  const out: string[] = [];
  for (const part of (base + href.split("#")[0]).split("/")) {
    if (part === "..") out.pop();
    else if (part && part !== ".") out.push(part);
  }
  return out.join("/");
}

export function visibleText(html: string): string {
  return decodeEntities(
    html
      .replace(/<head[\s\S]*?<\/head>/i, " ")
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export async function inspectEpub(data: Uint8Array): Promise<EpubInfo> {
  const zip = await JSZip.loadAsync(data);
  const container = await zip.file("META-INF/container.xml")?.async("string");
  const opfPath = container ? attribute(/<rootfile\b[^>]*>/i.exec(container)?.[0] ?? "", "full-path") : undefined;
  if (!opfPath) throw new Error("EPUB has no package document");
  const opf = await zip.file(opfPath)?.async("string");
  if (!opf) throw new Error("EPUB package document is missing");
  const base = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";

  const manifest = new Map<string, { href: string; type: string }>();
  for (const [tag] of opf.matchAll(/<item\b[^>]*>/gi)) {
    const id = attribute(tag, "id");
    const href = attribute(tag, "href");
    if (!id || !href) continue;
    let decoded = href;
    try {
      decoded = decodeURIComponent(href);
    } catch {
      // keep the raw href
    }
    manifest.set(id, { href: decoded, type: attribute(tag, "media-type") ?? "" });
  }

  let textLength = 0;
  let budget = MAX_TOTAL_CHARS;
  const spine = [...opf.matchAll(/<itemref\b[^>]*>/gi)].map(([tag]) => attribute(tag, "idref"));
  for (const idref of spine.slice(0, MAX_SPINE_FILES)) {
    const item = idref ? manifest.get(idref) : undefined;
    if (!item || !item.type.includes("html")) continue;
    const file = zip.file(resolvePath(base, item.href));
    if (!file) continue;
    const html = await file.async("string");
    budget -= html.length;
    if (budget < 0) break;
    textLength += visibleText(html).length;
  }

  return {
    title: firstElement(opf, "dc:title"),
    creator: firstElement(opf, "dc:creator"),
    language: firstElement(opf, "dc:language"),
    description: firstElement(opf, "dc:description"),
    textLength,
  };
}

/** Rough printed-page estimate from visible characters. */
export function estimatePages(textLength: number, lang: "ar" | "en"): number | null {
  if (textLength < 500) return null;
  return Math.max(1, Math.round(textLength / (lang === "ar" ? 1500 : 1900)));
}
