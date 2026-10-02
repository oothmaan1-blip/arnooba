import assert from "node:assert/strict";
import { test } from "node:test";
import JSZip from "jszip";
import { buildCsp } from "../src/lib/csp.ts";
import { ipAllowed, pickClientIp, UNKNOWN_IP } from "../src/lib/ip.ts";
import { PdfScanner, scanEpub, scanPdfBytes } from "../src/lib/scan.ts";

const latin1 = (text: string) => new Uint8Array(Buffer.from(text, "latin1"));

test("client IP comes from forwarding headers only behind a trusted proxy", () => {
  const forged = new Headers({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "5.6.7.8" });
  assert.equal(pickClientIp(forged, {}), UNKNOWN_IP);
  assert.equal(pickClientIp(forged, { VERCEL: "1" }), "5.6.7.8");
  assert.equal(pickClientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }), { TRUST_PROXY: "1" }), "9.9.9.9");
  assert.equal(pickClientIp(new Headers({ "x-real-ip": "<script>" }), { VERCEL: "1" }), UNKNOWN_IP);
});

test("admin IP allow-list supports exact addresses and IPv4 ranges", () => {
  assert.ok(ipAllowed("8.8.8.8", ""));
  assert.ok(ipAllowed("203.0.113.7", "203.0.113.7"));
  assert.ok(ipAllowed("198.51.100.42", "203.0.113.7, 198.51.100.0/24"));
  assert.ok(!ipAllowed("198.51.101.1", "198.51.100.0/24"));
  assert.ok(!ipAllowed(UNKNOWN_IP, "198.51.100.0/24"));
  assert.ok(ipAllowed("2001:db8::1", "2001:db8::1"));
  assert.ok(!ipAllowed("10.0.0.1", "10.0.0.0/33"));
});

test("page CSP requires the nonce for scripts", () => {
  const csp = buildCsp("abc123", { NODE_ENV: "production" } as NodeJS.ProcessEnv);
  const scriptSrc = csp.split("; ").find((d) => d.startsWith("script-src")) ?? "";
  assert.match(scriptSrc, /'nonce-abc123'/);
  assert.match(scriptSrc, /'strict-dynamic'/);
  assert.doesNotMatch(scriptSrc, /'unsafe-inline'|'unsafe-eval'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /base-uri 'none'/);
  assert.doesNotMatch(csp, /upgrade-insecure-requests/);
  assert.match(buildCsp("x", { NODE_ENV: "production", VERCEL: "1" } as NodeJS.ProcessEnv), /upgrade-insecure-requests/);
});

test("PDF scanner finds active content, also when hex-escaped or split across chunks", () => {
  assert.equal(scanPdfBytes(latin1("%PDF-1.7\n1 0 obj << /S /JavaScript /JS (app.alert(1)) >> endobj")), "JavaScript");
  assert.equal(scanPdfBytes(latin1("%PDF-1.7\n1 0 obj << /S /J#61vaScript >> endobj")), "JavaScript");
  assert.equal(scanPdfBytes(latin1("%PDF-1.4 << /Type /Action /S /Launch /F (cmd.exe) >>")), "Launch");
  assert.equal(scanPdfBytes(latin1("%PDF-1.4 << /Names << /EmbeddedFiles 4 0 R >> >>")), "EmbeddedFiles");

  const split = new PdfScanner();
  assert.equal(split.push(latin1("%PDF-1.7 << /S /Java")), null);
  assert.equal(split.push(latin1("Script >>")) ?? split.finish(), "JavaScript");
});

test("PDF scanner ignores binary stream bodies and ordinary books", () => {
  const book = "%PDF-1.4\n1 0 obj << /Type /Page /Contents 2 0 R >> endobj\n2 0 obj << /Length 40 >>\nstream\nBT /F1 12 Tf (/JS looks scary here) Tj ET\nendstream\nendobj\n%%EOF";
  assert.equal(scanPdfBytes(latin1(book)), null);
  const chunked = new PdfScanner();
  for (let i = 0; i < book.length; i += 7) assert.equal(chunked.push(latin1(book.slice(i, i + 7))), null);
  assert.equal(chunked.finish(), null);
});

async function epubWith(files: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", '<container><rootfiles><rootfile full-path="OPS/content.opf"/></rootfiles></container>');
  zip.file("OPS/content.opf", '<package><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest></package>');
  for (const [name, body] of Object.entries(files)) zip.file(name, body);
  return zip.generateAsync({ type: "uint8array" });
}

test("EPUB scanner rejects scripts and accepts plain books", async () => {
  assert.equal(await scanEpub(await epubWith({ "OPS/c1.xhtml": "<html><body><p>Once upon a time, someone = brave.</p></body></html>" })), null);
  assert.match((await scanEpub(await epubWith({ "OPS/c1.xhtml": "<html><body><script>alert(1)</script></body></html>" }))) ?? "", /script/);
  assert.ok(await scanEpub(await epubWith({ "OPS/c1.xhtml": '<html><body><img src="x" onerror="alert(1)"/></body></html>' })));
  assert.ok(await scanEpub(await epubWith({ "OPS/c1.xhtml": '<html><body><a href="javascript:alert(1)">x</a></body></html>' })));
  assert.ok(await scanEpub(await epubWith({ "OPS/evil.js": "alert(1)" })));
  assert.ok(await scanEpub(await epubWith({ "OPS/pic.svg": '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>' })));
});
