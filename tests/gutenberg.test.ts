import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cleanTitle,
  isSafePublicDomain,
  mapCategory,
  personName,
  summaryOf,
  type GutendexBook,
} from "../src/lib/import/gutenberg-rules.ts";

function book(overrides: Partial<GutendexBook> = {}): GutendexBook {
  return {
    id: 1,
    title: "Title",
    authors: [{ name: "Austen, Jane", birth_year: 1775, death_year: 1817 }],
    translators: [],
    subjects: [],
    bookshelves: [],
    languages: ["en"],
    copyright: false,
    media_type: "Text",
    formats: {},
    download_count: 1,
    ...overrides,
  };
}

const NOW = new Date(Date.UTC(2026, 9, 1));

test("personName flips 'Last, First' and drops expansions", () => {
  assert.equal(personName("Austen, Jane"), "Jane Austen");
  assert.equal(personName("Wells, H. G. (Herbert George)"), "H. G. Wells");
  assert.equal(personName("Homer"), "Homer");
  assert.equal(personName("Tolstoy, Leo, graf"), "Leo Tolstoy");
});

test("public-domain filter covers authors, translators and editors", () => {
  assert.ok(isSafePublicDomain(book(), NOW));
  assert.ok(!isSafePublicDomain(book({ copyright: true }), NOW));
  assert.ok(!isSafePublicDomain(book({ copyright: null }), NOW));
  assert.ok(!isSafePublicDomain(book({ authors: [] }), NOW));
  assert.ok(!isSafePublicDomain(book({ authors: [{ name: "Late, Author", birth_year: 1890, death_year: 1960 }] }), NOW));
  assert.ok(isSafePublicDomain(book({ authors: [{ name: "Old, Author", birth_year: 1870, death_year: 1955 }] }), NOW));
  assert.ok(
    !isSafePublicDomain(book({ translators: [{ name: "Modern, Translator", birth_year: 1920, death_year: 1990 }] }), NOW),
  );
  assert.ok(isSafePublicDomain(book({ authors: [{ name: "Homer", birth_year: -750, death_year: null }] }), NOW));
  assert.ok(!isSafePublicDomain(book({ authors: [{ name: "Mystery, Person", birth_year: null, death_year: null }] }), NOW));
  assert.ok(isSafePublicDomain(book({ authors: [{ name: "Anonymous", birth_year: null, death_year: null }] }), NOW));
  assert.ok(!isSafePublicDomain(book({ authors: [{ name: "Various", birth_year: null, death_year: null }] }), NOW));
});

test("mapCategory ignores generic literature shelves", () => {
  assert.equal(mapCategory(["England -- Fiction", "Love stories"], ["Category: Novels", "Category: British Literature"]), "novels");
  assert.equal(mapCategory(["Fantasy fiction", "Children's stories"], ["Category: Children & Young Adult Reading"]), "fantasy");
  assert.equal(mapCategory(["Fairy tales -- Germany"], []), "fantasy");
  assert.equal(mapCategory(["Science fiction", "Horror tales"], ["Category: Novels"]), "fantasy");
  assert.equal(mapCategory(["Vampires -- Fiction", "Epistolary fiction"], []), "fantasy");
  assert.equal(mapCategory(["Boys -- Juvenile fiction"], ["Category: Children & Young Adult Reading"]), "children");
  assert.equal(mapCategory(["Statesmen -- Biography"], ["Category: American Literature", "Category: Biographies"]), "history");
  assert.equal(mapCategory(["Epic poetry, Greek"], ["Category: Poetry", "Category: Classics of Literature"]), "literature");
  assert.equal(mapCategory(["Stoics", "Ethics"], ["Category: Philosophy & Ethics"]), "philosophy");
  assert.equal(mapCategory(["Evolution (Biology)"], ["Category: Science - Biology", "Category: Classics of Literature"]), "science");
  assert.equal(mapCategory([], []), "other");
});

test("titles and summaries are tidied", () => {
  assert.equal(cleanTitle("Frankenstein\r\nOr, The Modern Prometheus"), "Frankenstein: Or, The Modern Prometheus");
  assert.equal(cleanTitle("Eloisa : $b or, A series of original letters"), "Eloisa: or, A series of original letters");
  assert.equal(
    summaryOf(book({ summaries: ["A tale. (This is an automatically generated summary.)"] })),
    "A tale.",
  );
});
