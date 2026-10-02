import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import JSZip from "jszip";
import { extractEntry, planRanges, readCentralDirectory } from "../src/lib/zip-directory.ts";

async function sampleEpub() {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "DEFLATE" }); // Hindawi-style: compressed
  zip.file("EPUB/Style/epub.css", "@font-face{font-family:A;src:url(../Fonts/used.ttf)}");
  zip.file("EPUB/Fonts/unused.ttf", randomBytes(200_000)); // incompressible, 200 KB
  zip.file("EPUB/Fonts/used.ttf", randomBytes(5_000));
  zip.file("EPUB/Content/chapter-1.xhtml", "<html><body><p>" + "قصة ".repeat(2000) + "</p></body></html>");
  return { zip, bytes: await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" }) };
}

test("reads the central directory from the tail of a ZIP", async () => {
  const { bytes } = await sampleEpub();
  const tailStart = bytes.byteLength - 4096;
  const dir = readCentralDirectory(bytes.subarray(tailStart), tailStart);
  assert.ok(dir);
  assert.deepEqual(
    dir.entries.map((e) => e.name).filter((name) => !name.endsWith("/")),
    ["mimetype", "EPUB/Style/epub.css", "EPUB/Fonts/unused.ttf", "EPUB/Fonts/used.ttf", "EPUB/Content/chapter-1.xhtml"],
  );
  // The tail must contain the whole directory, or we say so.
  assert.equal(readCentralDirectory(bytes.subarray(bytes.byteLength - 30), bytes.byteLength - 30), null);
});

test("downloads only the wanted entries and extracts them intact", async () => {
  const { zip, bytes } = await sampleEpub();
  const tailStart = bytes.byteLength - 4096;
  const dir = readCentralDirectory(bytes.subarray(tailStart), tailStart)!;
  const ranges = planRanges(dir.entries, dir.cdOffset, (e) => !e.name.endsWith("/") && e.name !== "EPUB/Fonts/unused.ttf", 1024);
  // The big unused font splits the file into two ranges and is never fetched.
  assert.equal(ranges.length, 2);
  const fetched = ranges.reduce((n, r) => n + (r.end - r.start + 1), 0);
  assert.ok(fetched < bytes.byteLength - 190_000);

  for (const range of ranges) {
    const chunk = bytes.subarray(range.start, range.end + 1);
    for (const entry of range.entries) {
      const got = extractEntry(chunk, range.start, entry);
      const want = await zip.file(entry.name)!.async("uint8array");
      assert.deepEqual(Buffer.from(got), Buffer.from(want), entry.name);
    }
  }
});

test("rejects a chunk that does not start at the entry", async () => {
  const { bytes } = await sampleEpub();
  const tailStart = bytes.byteLength - 4096;
  const dir = readCentralDirectory(bytes.subarray(tailStart), tailStart)!;
  const css = dir.entries[1];
  assert.throws(() => extractEntry(bytes.subarray(css.offset + 1), css.offset + 1, css), /local header/);
});
