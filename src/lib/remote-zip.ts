// Reads selected entries of a remote ZIP (an EPUB) with HTTP Range requests, so
// big entries we would throw away (unused fonts) are never downloaded. Falls
// back to the caller downloading the whole file when the server or the archive
// is not cooperative.
import { fetchRange } from "./fetch-file";
import { extractEntry, planRanges, readCentralDirectory, type ZipEntry } from "./zip-directory";

/**
 * Downloads the entries of a remote ZIP for which `keep(entry, styles)` is true.
 * `keep` gets the already-downloaded stylesheets so it can decide
 * which fonts are referenced. Returns null if ranges are not supported.
 */
export async function fetchZipEntries(
  url: string,
  accept: string,
  keep: (entry: ZipEntry, styles: string[]) => boolean,
): Promise<Map<string, Uint8Array> | null> {
  const tailSize = 256 * 1024;
  const tail = await fetchRange(url, `bytes=-${tailSize}`, accept).catch(() => null);
  if (!tail) return null;
  const directory = readCentralDirectory(tail.data, tail.start);
  if (!directory) return null;
  const { entries, cdOffset } = directory;

  const files = new Map<string, Uint8Array>();
  const download = async (wanted: (e: ZipEntry) => boolean) => {
    for (const range of planRanges(entries, cdOffset, wanted)) {
      const inTail = range.start >= tail.start;
      const chunk = inTail
        ? { data: tail.data.subarray(range.start - tail.start), start: range.start }
        : await fetchRange(url, `bytes=${range.start}-${range.end}`, accept);
      for (const entry of range.entries) files.set(entry.name, extractEntry(chunk.data, chunk.start, entry));
    }
  };
  // Stylesheets first: they say which fonts are used.
  await download((e) => /\.css$/i.test(e.name));
  const decoder = new TextDecoder();
  const styles = [...files.entries()].filter(([name]) => /\.css$/i.test(name)).map(([, data]) => decoder.decode(data));
  await download((e) => !files.has(e.name) && !e.name.endsWith("/") && keep(e, styles));
  return files;
}
