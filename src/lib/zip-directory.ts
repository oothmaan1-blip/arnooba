// Pure ZIP central-directory reading (no imports besides node:zlib, so tests
// can load this file directly). Used to fetch parts of remote EPUBs.
import { inflateRawSync } from "node:zlib";

export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  offset: number;
}

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

/** Parses the central directory from the last bytes of a ZIP. */
export function readCentralDirectory(tail: Uint8Array, tailStart: number): { entries: ZipEntry[]; cdOffset: number } | null {
  const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = view.getUint16(eocd + 10, true);
  const cdSize = view.getUint32(eocd + 12, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (cdOffset === 0xffffffff || cdOffset < tailStart || cdOffset + cdSize > tailStart + tail.byteLength) return null; // ZIP64 or not in tail
  const entries: ZipEntry[] = [];
  let p = cdOffset - tailStart;
  const decoder = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (p + 46 > tail.byteLength || view.getUint32(p, true) !== CENTRAL) return null;
    const nameLength = view.getUint16(p + 28, true);
    const extraLength = view.getUint16(p + 30, true);
    const commentLength = view.getUint16(p + 32, true);
    entries.push({
      name: decoder.decode(tail.subarray(p + 46, p + 46 + nameLength)),
      method: view.getUint16(p + 10, true),
      compressedSize: view.getUint32(p + 20, true),
      size: view.getUint32(p + 24, true),
      offset: view.getUint32(p + 42, true),
    });
    p += 46 + nameLength + extraLength + commentLength;
  }
  return { entries, cdOffset };
}

/** Extracts one entry's bytes from a buffer that starts at file offset `base`. */
export function extractEntry(buffer: Uint8Array, base: number, entry: ZipEntry): Uint8Array {
  const at = entry.offset - base;
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (at < 0 || at + 30 > buffer.byteLength || view.getUint32(at, true) !== LOCAL) throw new Error(`bad local header: ${entry.name}`);
  const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
  const data = buffer.subarray(start, start + entry.compressedSize);
  if (data.byteLength !== entry.compressedSize) throw new Error(`truncated entry: ${entry.name}`);
  if (entry.method === 0) return data;
  if (entry.method === 8) return new Uint8Array(inflateRawSync(data, { maxOutputLength: Math.max(entry.size, 1) }));
  throw new Error(`unsupported compression ${entry.method}: ${entry.name}`);
}

/** Groups the byte spans of the wanted entries into a few ranges (merging small gaps). */
export function planRanges(entries: ZipEntry[], cdOffset: number, wanted: (e: ZipEntry) => boolean, gap = 64 * 1024) {
  const sorted = [...entries].sort((a, b) => a.offset - b.offset);
  const ranges: { start: number; end: number; entries: ZipEntry[] }[] = [];
  sorted.forEach((entry, i) => {
    if (!wanted(entry)) return;
    // An entry ends where the next one starts (or at the central directory).
    const end = (sorted[i + 1]?.offset ?? cdOffset) - 1;
    const last = ranges[ranges.length - 1];
    if (last && entry.offset - last.end <= gap) {
      last.end = end;
      last.entries.push(entry);
    } else {
      ranges.push({ start: entry.offset, end, entries: [entry] });
    }
  });
  return ranges;
}
