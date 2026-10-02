import assert from "node:assert/strict";
import { test } from "node:test";
import { parseGutenbergRdf } from "../src/lib/import/gutenberg-rdf.ts";
import { isSafePublicDomain, mapCategory } from "../src/lib/import/gutenberg-rules.ts";

const RDF = `<?xml version="1.0" encoding="utf-8"?>
<rdf:RDF xmlns:pgterms="http://www.gutenberg.org/2009/pgterms/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:dcterms="http://purl.org/dc/terms/" xmlns:marcrel="http://id.loc.gov/vocabulary/relators/">
  <pgterms:ebook rdf:about="ebooks/55">
    <dcterms:rights>Public domain in the USA.</dcterms:rights>
    <pgterms:downloads rdf:datatype="http://www.w3.org/2001/XMLSchema#integer">38574</pgterms:downloads>
    <dcterms:creator>
      <pgterms:agent rdf:about="2009/agents/42">
        <pgterms:name>Baum, L. Frank (Lyman Frank)</pgterms:name>
        <pgterms:birthdate rdf:datatype="http://www.w3.org/2001/XMLSchema#integer">1856</pgterms:birthdate>
        <pgterms:deathdate rdf:datatype="http://www.w3.org/2001/XMLSchema#integer">1919</pgterms:deathdate>
      </pgterms:agent>
    </dcterms:creator>
    <marcrel:trl>
      <pgterms:agent rdf:about="2009/agents/9">
        <pgterms:name>Someone, Modern</pgterms:name>
        <pgterms:birthdate rdf:datatype="http://www.w3.org/2001/XMLSchema#integer">1950</pgterms:birthdate>
      </pgterms:agent>
    </marcrel:trl>
    <dcterms:title>The Wonderful Wizard of Oz</dcterms:title>
    <pgterms:marc520>A cyclone &amp; a yellow brick road. (This is an automatically generated summary.)</pgterms:marc520>
    <dcterms:language><rdf:Description><rdf:value rdf:datatype="http://purl.org/dc/terms/RFC4646">en</rdf:value></rdf:Description></dcterms:language>
    <dcterms:subject><rdf:Description><rdf:value>Fantasy literature</rdf:value></rdf:Description></dcterms:subject>
    <dcterms:type><rdf:Description><rdf:value>Text</rdf:value></rdf:Description></dcterms:type>
    <pgterms:bookshelf><rdf:Description><rdf:value>Category: Children &amp; Young Adult Reading</rdf:value></rdf:Description></pgterms:bookshelf>
    <dcterms:hasFormat><pgterms:file rdf:about="https://www.gutenberg.org/ebooks/55.epub.images"></pgterms:file></dcterms:hasFormat>
    <dcterms:hasFormat><pgterms:file rdf:about="https://www.gutenberg.org/ebooks/55.epub3.images"></pgterms:file></dcterms:hasFormat>
    <dcterms:hasFormat><pgterms:file rdf:about="https://www.gutenberg.org/cache/epub/55/pg55.cover.medium.jpg"></pgterms:file></dcterms:hasFormat>
  </pgterms:ebook>
</rdf:RDF>`;

test("parses the Gutenberg RDF record into the importer's shape", () => {
  const book = parseGutenbergRdf(55, RDF);
  assert.equal(book.title, "The Wonderful Wizard of Oz");
  assert.deepEqual(book.authors, [{ name: "Baum, L. Frank (Lyman Frank)", birth_year: 1856, death_year: 1919 }]);
  assert.equal(book.translators?.[0]?.death_year, null);
  assert.deepEqual(book.languages, ["en"]);
  assert.deepEqual(book.subjects, ["Fantasy literature"]);
  assert.deepEqual(book.bookshelves, ["Category: Children & Young Adult Reading"]);
  assert.equal(book.media_type, "Text");
  assert.equal(book.copyright, false);
  assert.equal(book.download_count, 38574);
  assert.equal(book.formats["application/epub+zip"], "https://www.gutenberg.org/ebooks/55.epub3.images");
  assert.equal(book.formats["image/jpeg"], "https://www.gutenberg.org/cache/epub/55/pg55.cover.medium.jpg");
  assert.equal(book.summaries?.[0]?.startsWith("A cyclone & a yellow"), true);
  assert.equal(mapCategory(book.subjects, book.bookshelves), "fantasy");
});

test("a living or unknown translator keeps the book out", () => {
  const book = parseGutenbergRdf(55, RDF);
  assert.equal(isSafePublicDomain(book, new Date(Date.UTC(2026, 9, 1))), false);
  assert.equal(isSafePublicDomain({ ...book, translators: [] }, new Date(Date.UTC(2026, 9, 1))), true);
});

test("non-US-public-domain rights are treated as copyrighted", () => {
  const book = parseGutenbergRdf(1, RDF.replace("Public domain in the USA.", "Copyrighted. Read the copyright notice."));
  assert.equal(book.copyright, true);
});
