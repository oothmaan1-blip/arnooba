// Fills the library from the command line, using the same importers as the
// admin panel. Reads .env.local like Next.js does, so it can target the local
// embedded database or a production DATABASE_URL + bucket.
//
//   npm run seed                  → Arabic starter list + 30 English books
//   npm run seed -- --english=100 → Arabic starter list + 100 English books
//   npm run seed -- --arabic-only / --english-only
//   npm run seed -- --english-only --english=40 --topic=fantasy
//   npm run seed -- --ids=55,16,35   (specific Gutenberg book numbers)
//   npm run seed -- --picks          (hand-picked fantasy & adventure classics)
//   npm run seed -- --hindawi        (complete Arabic novels, history, sci-fi and
//                                     mystery from the Hindawi Foundation, CC BY)
//   npm run seed -- --covers         (draws a cover for every book without one)
//   npm run seed -- --prune          (removes Wikisource books found incomplete,
//                                     or replaced by complete Hindawi editions)
//
// With the local embedded database, stop `npm run dev` first: only one
// process may open it at a time.
import nextEnv from "@next/env";
import { fetchGutendexBook, importGutenbergBatch, importGutenbergBook } from "../src/lib/import/gutenberg";
import { GUTENBERG_PICKS } from "../src/lib/import/gutenberg-picks";
import { importHindawiBook } from "../src/lib/import/hindawi";
import { HINDAWI_PICKS } from "../src/lib/import/hindawi-picks";
import { importWikisourceBook } from "../src/lib/import/wikisource";
import { RETIRED_WIKISOURCE_PAGES, WIKISOURCE_STARTER } from "../src/lib/import/wikisource-starter";
import { booksWithoutCover, deleteBook, getBookBySourceId, updateBook } from "../src/lib/books";
import { generateCover } from "../src/lib/cover-art";
import { deleteObject, newKey, putObject } from "../src/lib/storage";

nextEnv.loadEnvConfig(process.cwd());

const args = process.argv.slice(2);
const englishArg = args.find((a) => a.startsWith("--english="));
const englishTarget = englishArg ? Math.max(0, Number(englishArg.split("=")[1]) || 0) : 30;
// e.g. --topic=fantasy, --topic="science fiction", --topic="fairy tales"
const topic = args.find((a) => a.startsWith("--topic="))?.slice("--topic=".length) ?? "";
// e.g. --ids=55,16,35 (Gutenberg book numbers; still filtered for copyright),
// or --picks for the hand-picked fantasy/adventure classics.
const ids = args.includes("--picks")
  ? GUTENBERG_PICKS.map((p) => p.id)
  : (args.find((a) => a.startsWith("--ids="))?.slice("--ids=".length) ?? "")
      .split(",")
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isSafeInteger(n) && n > 0);
const doArabic = !args.includes("--english-only");
const doEnglish = !args.includes("--arabic-only") && englishTarget > 0;

async function seedArabic() {
  console.log(`\n— Arabic classics from Wikisource (${WIKISOURCE_STARTER.length}) —`);
  for (const entry of WIKISOURCE_STARTER) {
    try {
      const result = await importWikisourceBook(entry);
      const note = result.status === "skipped" ? `skipped: ${result.reason}` : result.status;
      console.log(`  ${note.padEnd(10)} ${entry.title}`);
    } catch (err) {
      console.log(`  failed     ${entry.title}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

async function seedEnglish() {
  console.log(`\n— English books from Project Gutenberg (target ${englishTarget}${topic ? `, topic "${topic}"` : ""}) —`);
  let page = 1;
  let imported = 0;
  let idlePages = 0;
  while (imported < englishTarget) {
    let batch;
    try {
      batch = await importGutenbergBatch("en", page, Math.min(5, englishTarget - imported), topic);
    } catch (err) {
      console.log(`  page ${page} failed (${err instanceof Error ? err.message : err}); stopping, run again to resume`);
      break;
    }
    for (const book of batch.imported) console.log(`  imported   ${book.title}`);
    for (const failure of batch.failed) console.log(`  failed     ${failure.title}: ${failure.reason}`);
    imported += batch.imported.length;
    idlePages = batch.imported.length ? 0 : idlePages + 1;
    if (batch.nextPage === null || idlePages >= 15) break;
    page = batch.nextPage;
  }
  console.log(`  ${imported} new English books`);
}

async function seedHindawi() {
  console.log(`\n— Complete Arabic books from the Hindawi Foundation (${HINDAWI_PICKS.length}) —`);
  let imported = 0;
  let next = 0;
  // A few downloads at a time: faster on slow links, still gentle on the server.
  const worker = async () => {
    while (next < HINDAWI_PICKS.length) {
      const i = next++;
      const entry = HINDAWI_PICKS[i];
      const label = `[${i + 1}/${HINDAWI_PICKS.length}] ${entry.title}`;
      try {
        const result = await importHindawiBook(entry);
        if (result.status === "imported") imported++;
        console.log(`  ${(result.status === "skipped" ? `skipped: ${result.reason}` : result.status).padEnd(10)} ${label}`);
      } catch (err) {
        console.log(`  failed     ${label}: ${err instanceof Error ? err.message : err}`);
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  console.log(`  ${imported} new books (run again to retry failures)`);
}

async function seedCovers() {
  const books = await booksWithoutCover("ar");
  console.log(`\n— Covers for ${books.length} Arabic books without one —`);
  for (const book of books) {
    const cover = await generateCover(book);
    const key = newKey("cover", "jpg");
    await putObject(key, cover, { contentType: "image/jpeg" });
    await updateBook(book.id, { coverKey: key });
    console.log(`  cover      ${book.title}`);
  }
}

async function seedPrune() {
  console.log(`\n— Removing ${RETIRED_WIKISOURCE_PAGES.length} retired Wikisource books —`);
  for (const page of RETIRED_WIKISOURCE_PAGES) {
    const book = await getBookBySourceId(`wikisource:ar:${page}`);
    if (!book) continue;
    await deleteBook(book.id);
    await Promise.all([book.epubKey, book.pdfKey, book.coverKey].map((key) => deleteObject(key)));
    console.log(`  removed    ${book.title}`);
  }
}

async function seedIds() {
  console.log(`\n— Gutenberg books by number (${ids.length}) —`);
  for (const id of ids) {
    try {
      const result = await importGutenbergBook(await fetchGutendexBook(id));
      const label = result.status === "skipped" ? `skipped: ${result.reason}` : result.status;
      console.log(`  ${label.padEnd(10)} #${id} ${result.status === "skipped" ? "" : result.book.title}`);
    } catch (err) {
      console.log(`  failed     #${id}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

const doHindawi = args.includes("--hindawi");
const doCovers = args.includes("--covers");
const doPrune = args.includes("--prune");
if (doPrune) await seedPrune();
if (doHindawi) await seedHindawi();
if (ids.length) await seedIds();
if (!doHindawi && !doCovers && !doPrune && !ids.length) {
  if (doArabic) await seedArabic();
  if (doEnglish) await seedEnglish();
}
// Arabic imports bring or draw their own covers; this fills in older books.
if (doCovers) await seedCovers();
console.log("\nDone.");
process.exit(0);
