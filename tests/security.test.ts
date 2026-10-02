import assert from "node:assert/strict";
import { test } from "node:test";
import { sniff } from "../src/lib/magic.ts";
import { makeToken, passwordMatches, verifyToken } from "../src/lib/token.ts";
import { safeExternalUrl } from "../src/lib/url.ts";

const bytes = (...parts: (string | number[])[]) =>
  Uint8Array.from(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));

function epubHeader(extra = 0): Uint8Array {
  const header = new Uint8Array(30 + 8 + extra + 20);
  header.set(bytes("PK", [3, 4]));
  header[26] = 8;
  header[28] = extra;
  header.set(bytes("mimetype"), 30);
  header.set(bytes("application/epub+zip"), 38 + extra);
  return header;
}

test("sniff recognises real formats by their bytes", () => {
  assert.equal(sniff(bytes("%PDF-1.7\n")), "pdf");
  assert.equal(sniff(bytes("\n\n  %PDF-1.4")), "pdf");
  assert.equal(sniff(epubHeader()), "epub");
  assert.equal(sniff(epubHeader(4)), "epub");
  assert.equal(sniff(bytes([0xff, 0xd8, 0xff, 0xe0])), "jpeg");
  assert.equal(sniff(bytes([0x89], "PNG\r\n", [0x1a], "\n")), "png");
  assert.equal(sniff(bytes("RIFF", [0, 0, 0, 0], "WEBP")), "webp");
});

test("sniff rejects lookalikes", () => {
  assert.equal(sniff(bytes("<html><script>alert(1)</script>")), null);
  assert.equal(sniff(bytes("PK", [3, 4], "not an epub at all..........................")), null);
  const docx = epubHeader();
  docx.set(bytes("application/zip+epub"), 38);
  assert.equal(sniff(docx), null);
  assert.equal(sniff(new Uint8Array()), null);
});

test("tokens are bound to secret, scope and expiry", () => {
  const now = Date.UTC(2026, 0, 1);
  const token = makeToken("s".repeat(40), "admin", 60, now);
  assert.ok(verifyToken("s".repeat(40), "admin", token, now));
  assert.ok(!verifyToken("t".repeat(40), "admin", token, now));
  assert.ok(!verifyToken("s".repeat(40), "upload:x", token, now));
  assert.ok(!verifyToken("s".repeat(40), "admin", token, now + 61_000));
  assert.ok(!verifyToken("s".repeat(40), "admin", `${token}x`, now));
  assert.ok(!verifyToken("s".repeat(40), "admin", "9999999999.", now));
  assert.ok(!verifyToken("s".repeat(40), "admin", undefined, now));
});

test("password comparison", () => {
  assert.ok(passwordMatches("k".repeat(40), "correct horse", "correct horse"));
  assert.ok(!passwordMatches("k".repeat(40), "correct hors", "correct horse"));
  assert.ok(!passwordMatches("k".repeat(40), "", "correct horse"));
});

test("only http(s) links reach an href", () => {
  assert.equal(safeExternalUrl("https://ar.wikisource.org/wiki/x"), "https://ar.wikisource.org/wiki/x");
  assert.equal(safeExternalUrl("javascript:alert(1)"), null);
  assert.equal(safeExternalUrl("data:text/html,hi"), null);
  assert.equal(safeExternalUrl("not a url"), null);
  assert.equal(safeExternalUrl(""), null);
});
