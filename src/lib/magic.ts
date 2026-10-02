// Identifies uploaded files by their first bytes instead of trusting the
// name or the Content-Type the browser sent. Dependency-free for tests.

export type FileKind = "pdf" | "epub" | "jpeg" | "png" | "webp";

export const SNIFF_BYTES = 1024;

function hasAscii(bytes: Uint8Array, offset: number, text: string): boolean {
  if (offset + text.length > bytes.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

export function sniff(bytes: Uint8Array): FileKind | null {
  // The PDF header may be preceded by junk, but must sit in the first 1 KB.
  const head = Math.min(bytes.length, SNIFF_BYTES) - 5;
  for (let i = 0; i <= head; i++) {
    if (bytes[i] === 0x25 && hasAscii(bytes, i, "%PDF-")) return "pdf";
  }

  // EPUB (OCF): a zip whose first entry is an uncompressed "mimetype" file.
  if (hasAscii(bytes, 0, "PK\u0003\u0004")) {
    if (bytes.length < 30) return null;
    const nameLength = bytes[26] | (bytes[27] << 8);
    const extraLength = bytes[28] | (bytes[29] << 8);
    const dataStart = 30 + nameLength + extraLength;
    if (nameLength === 8 && hasAscii(bytes, 30, "mimetype") && hasAscii(bytes, dataStart, "application/epub+zip")) {
      return "epub";
    }
    return null;
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (hasAscii(bytes, 0, "\u0089PNG\r\n\u001a\n")) return "png";
  if (hasAscii(bytes, 0, "RIFF") && hasAscii(bytes, 8, "WEBP")) return "webp";
  return null;
}

export const KIND_EXT: Record<FileKind, string> = {
  pdf: "pdf",
  epub: "epub",
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};
