import assert from "node:assert/strict";
import { test } from "node:test";
import {
  arCount,
  BOOK_FORMS,
  contentDisposition,
  excerpt,
  fileNameFor,
  formatBytes,
  normalizeText,
  parseIdParam,
  searchTerms,
  slugify,
} from "../src/lib/text.ts";

test("normalizeText folds Arabic spelling variants", () => {
  assert.equal(normalizeText("إبن خلدون"), normalizeText("ابن خلدون"));
  assert.equal(normalizeText("مُقَدِّمَة"), normalizeText("مقدمه"));
  assert.equal(normalizeText("آمال"), "امال");
  assert.equal(normalizeText("مستشفى"), normalizeText("مستشفي"));
  assert.equal(normalizeText("مؤمن"), "مومن");
  assert.equal(normalizeText("شاطئ"), "شاطي");
  assert.equal(normalizeText("كتـــاب"), "كتاب");
  assert.equal(normalizeText("کتاب ی"), "كتاب ي");
  assert.equal(normalizeText("سنة ١٩٢٤ و ۲۰۲۴"), "سنه 1924 و 2024");
});

test("normalizeText lowercases Latin, strips accents and punctuation", () => {
  assert.equal(normalizeText("Pride & Prejudice!"), "pride prejudice");
  assert.equal(normalizeText("Les Misérables"), "les miserables");
  assert.equal(normalizeText("  a--b  "), "a b");
});

test("searchTerms drops the Arabic definite article from long words", () => {
  assert.deepEqual(searchTerms("الحمامة"), ["حمامه"]);
  assert.deepEqual(searchTerms("الحب"), ["الحب"]);
  assert.deepEqual(searchTerms("طوق  الحمامة طوق"), ["طوق", "حمامه"]);
  assert.deepEqual(searchTerms("%_\\"), []);
  assert.equal(searchTerms("a b c d e f g h i j k").length, 8);
});

test("slugify keeps Arabic letters and removes tashkeel", () => {
  assert.equal(slugify("كَلِيلَة وَدِمْنَة"), "كليلة-ودمنة");
  assert.equal(slugify("Pride and Prejudice"), "pride-and-prejudice");
  assert.equal(slugify("!!!"), "book");
  assert.ok(slugify("ا".repeat(200)).length <= 60);
});

test("parseIdParam reads the leading id only", () => {
  assert.equal(parseIdParam("12-كليلة-ودمنة"), 12);
  assert.equal(parseIdParam("7"), 7);
  assert.equal(parseIdParam("abc"), null);
  assert.equal(parseIdParam("12abc"), null);
  assert.equal(parseIdParam(undefined), null);
  assert.equal(parseIdParam("1234567890"), null);
});

test("fileNameFor removes characters that break file systems", () => {
  assert.equal(fileNameFor('a/b:c*?"<>|d', "x", "pdf"), "a b c d - x.pdf");
  assert.equal(fileNameFor("", "", "epub"), "book.epub");
  assert.ok(fileNameFor("t".repeat(500), "", "pdf").length <= 124);
});

test("contentDisposition is pure ASCII and cannot inject headers", () => {
  const header = contentDisposition('كتاب "خطير"\r\nSet-Cookie: x=1.pdf');
  assert.match(header, /^attachment; filename="[\x20-\x7e]*"; filename\*=UTF-8''[\x21-\x7e]+$/);
  assert.ok(!header.includes("\r") && !header.includes("\n"));
});

test("formatting helpers", () => {
  assert.equal(formatBytes(512), "1 KB");
  assert.equal(formatBytes(3.4 * 1024 * 1024), "3.4 MB");
  assert.equal(formatBytes(null), "");
  assert.equal(arCount(1, BOOK_FORMS), "كتاب واحد");
  assert.equal(arCount(2, BOOK_FORMS), "كتابان");
  assert.equal(arCount(5, BOOK_FORMS), "5 كتب");
  assert.equal(arCount(24, BOOK_FORMS), "24 كتاب");
  assert.equal(arCount(103, BOOK_FORMS), "103 كتب");
  assert.equal(excerpt("short"), "short");
  assert.ok(excerpt("word ".repeat(100), 40).endsWith("…"));
});
