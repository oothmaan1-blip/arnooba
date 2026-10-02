// Refuses uploads that carry active content: PDFs with JavaScript, launch
// actions or embedded files, and EPUBs with scripts. Our own readers never run
// such content, but other apps might once a reader downloads the file.
// Heuristic by nature (names inside compressed object streams are invisible),
// so it complements the checks done in the admin's browser.
import JSZip from "jszip";

const RISKY_PDF_NAMES = new Set([
  "JavaScript",
  "JS",
  "Launch",
  "EmbeddedFile",
  "EmbeddedFiles",
  "RichMedia",
  "XFA",
  "ImportData",
  "SubmitForm",
]);

/**
 * Streaming scanner over a PDF's dictionaries. Binary stream bodies are
 * skipped (random bytes would otherwise look like "/JS" now and then), and
 * names are decoded so "/J#61vaScript" is caught as "/JavaScript".
 */
export class PdfScanner {
  private carry = "";
  private inStream = false;
  found: string | null = null;

  private check(text: string): string | null {
    for (const match of text.matchAll(/\/([^\s/<>[\](){}%]{1,64})/g)) {
      const name = match[1].replace(/#([0-9a-fA-F]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
      if (RISKY_PDF_NAMES.has(name)) return (this.found = name);
    }
    return null;
  }

  push(chunk: Uint8Array): string | null {
    if (this.found) return this.found;
    // latin1 maps one byte to one char, so offsets and split tokens line up.
    const text = this.carry + Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength).toString("latin1");
    let scannable = "";
    let pos = 0;
    for (;;) {
      if (this.inStream) {
        const end = text.indexOf("endstream", pos);
        if (end === -1) {
          this.carry = text.slice(Math.max(pos, text.length - 8));
          return this.check(scannable);
        }
        pos = end + "endstream".length;
        this.inStream = false;
      } else {
        const start = text.indexOf("stream", pos);
        if (start === -1) {
          const keep = Math.max(pos, text.length - 80); // a name or keyword may continue in the next chunk
          scannable += text.slice(pos, keep);
          this.carry = text.slice(keep);
          return this.check(scannable);
        }
        scannable += text.slice(pos, start);
        pos = start + "stream".length;
        this.inStream = true;
      }
    }
  }

  finish(): string | null {
    if (this.found) return this.found;
    return this.inStream ? null : this.check(this.carry);
  }
}

export function scanPdfBytes(bytes: Uint8Array): string | null {
  const scanner = new PdfScanner();
  return scanner.push(bytes) ?? scanner.finish();
}

const SCRIPT_PATTERNS: [RegExp, string][] = [
  [/<script\b/i, "وسم script"],
  [/<[^>]+\son[a-z]+\s*=/i, "سمة حدث مثل onload"],
  [/(?:href|src)\s*=\s*["']\s*javascript:/i, "رابط javascript:"],
];

/** Describes the first script-like content in an EPUB, or returns null. */
export async function scanEpub(data: Uint8Array): Promise<string | null> {
  const zip = await JSZip.loadAsync(data);
  for (const file of Object.values(zip.files)) {
    if (file.dir) continue;
    const name = file.name.toLowerCase();
    if (/\.(m?js|exe|dll|bat|cmd|sh|ps1|vbs|jar|apk|msi|scr)$/.test(name)) return `ملف تنفيذي (${file.name})`;
    if (/\.(x?html?|svg|opf)$/.test(name)) {
      const text = await file.async("string");
      if (name.endsWith(".opf") && /properties\s*=\s*["'][^"']*\bscripted\b/i.test(text)) return "محتوى مُعلَّم بأنه يحوي سكربتات";
      for (const [pattern, label] of SCRIPT_PATTERNS) {
        if (pattern.test(text)) return `${label} (${file.name})`;
      }
    }
  }
  return null;
}
