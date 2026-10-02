// HTTP smoke test against a running server: public pages respond, private
// routes refuse anonymous access, and hostile inputs are handled.
//   node scripts/smoke.mjs [http://localhost:3000]
const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");
let failures = 0;

async function check(name, path, init, expect) {
  try {
    const res = await fetch(base + path, { redirect: "manual", ...init });
    const body = await res.text();
    const problem = expect(res, body);
    if (problem) {
      failures++;
      console.log(`FAIL ${name}: ${problem} (status ${res.status})`);
    } else {
      console.log(`ok   ${name}`);
    }
  } catch (err) {
    failures++;
    console.log(`FAIL ${name}: ${err.message}`);
  }
}

const status = (...codes) => (res) => (codes.includes(res.status) ? null : `expected ${codes.join("/")}`);

await check("home renders", "/", {}, (res, body) => (res.status === 200 && body.includes("أرنوبة") ? null : "home missing"));
await check("arabic list", "/ar", {}, status(200));
await check("english list", "/en", {}, status(200));
await check("made-into-films list", "/ar?film=1", {}, (res, body) =>
  res.status === 200 && body.includes("حكايات صارت أفلاماً") ? null : "film filter page missing",
);
await check("search arabic", `/search?q=${encodeURIComponent("إبن")}`, {}, status(200));
await check("about", "/about", {}, status(200));
await check("unknown page is 404", "/no-such-page", {}, status(404));
await check("unknown book is 404", "/book/999999-x", {}, status(404));
await check("sitemap", "/sitemap.xml", {}, (res, body) => (res.status === 200 && body.includes("<urlset") ? null : "no urlset"));
await check("robots", "/robots.txt", {}, (res, body) => (body.includes("Disallow: /admin") ? null : "admin not disallowed"));

const nonces = [];
await check("security headers", "/", {}, (res, body) => {
  const csp = res.headers.get("content-security-policy") ?? "";
  const scriptSrc = csp.split(";").find((d) => d.trim().startsWith("script-src")) ?? "";
  const nonce = /'nonce-([^']+)'/.exec(scriptSrc)?.[1];
  if (!nonce || !scriptSrc.includes("'strict-dynamic'")) return "script-src has no nonce";
  if (/'unsafe-inline'/.test(scriptSrc)) return "script-src allows inline scripts";
  if (!body.includes(`nonce="${nonce}"`)) return "scripts in the page do not carry the nonce";
  if (!csp.includes("object-src 'none'") || !csp.includes("frame-ancestors 'none'")) return "weak CSP";
  if (res.headers.get("x-content-type-options") !== "nosniff") return "no nosniff";
  if (res.headers.get("x-frame-options") !== "DENY") return "framing allowed";
  if (res.headers.get("x-powered-by")) return "x-powered-by leaks";
  nonces.push(nonce);
  return null;
});
await check("nonce changes per request", "/about", {}, (res) => {
  const nonce = /'nonce-([^']+)'/.exec(res.headers.get("content-security-policy") ?? "")?.[1];
  return nonce && !nonces.includes(nonce) ? null : "nonce reused";
});
await check("api responses are locked down", "/api/download/1?format=exe", {}, (res) =>
  (res.headers.get("content-security-policy") ?? "").startsWith("default-src 'none'") ? null : "api CSP missing",
);
await check("admin is not indexed", "/admin/login", {}, (res) =>
  (res.headers.get("x-robots-tag") ?? "").includes("noindex") && /no-store|no-cache/.test(res.headers.get("cache-control") ?? "")
    ? null
    : "admin pages indexable or cacheable",
);
await check("search output is escaped", `/search?q=${encodeURIComponent('<script>alert(1)</script>')}`, {}, (res, body) =>
  body.includes("<script>alert(1)</script>") ? "reflected script tag" : null,
);

await check("admin redirects to login", "/admin", {}, (res) =>
  res.status >= 300 && res.status < 400 && (res.headers.get("location") ?? "").includes("/admin/login") ? null : "not redirected",
);
await check("admin books redirects", "/admin/books", {}, (res) => (res.status >= 300 && res.status < 400 ? null : "not redirected"));
await check("upload targets need admin", "/api/admin/uploads", {
  method: "POST",
  headers: { "content-type": "application/json", origin: base },
  body: JSON.stringify({ files: [{ kind: "pdf", size: 10, type: "application/pdf" }] }),
}, status(401));
await check("local upload needs admin", "/api/admin/upload?key=books/00000000-0000-0000-0000-000000000000.pdf&token=1.x", {
  method: "PUT",
  headers: { origin: base },
  body: "%PDF-1.4",
}, status(401, 404));
await check("forged admin cookie rejected", "/admin", { headers: { cookie: "arnooba_admin=9999999999.forged" } }, (res) =>
  res.status >= 300 && res.status < 400 ? null : "forged cookie accepted",
);

await check("path traversal blocked", "/files/..%2f..%2f.env.local", {}, status(400, 404));
await check("path traversal blocked (plain)", "/files/../.env.local", {}, status(400, 404));
await check("non-uuid key blocked", "/files/books/evil.pdf", {}, status(404));
await check("download bad format", "/api/download/1?format=exe", {}, status(404));
await check("download unknown book", "/api/download/999999?format=epub", {}, status(404));
await check("report form for unknown book", "/report/999999", {}, status(404));

// A real book end to end: page, slug redirect, download redirect, file + Range.
const listing = await (await fetch(`${base}/ar`)).text();
const bookId = /href="\/book\/(\d+)-/.exec(listing)?.[1];
if (!bookId) {
  failures++;
  console.log("FAIL no Arabic book found to test (run npm run seed)");
} else {
  await check("book page", `/book/${bookId}`, {}, (res) =>
    res.status === 308 || res.status === 301 ? null : "bare id should redirect to the canonical slug",
  );
  let fileUrl = null;
  const format = (await fetch(`${base}/api/download/${bookId}?format=epub`, { method: "HEAD", redirect: "manual" })).status === 404 ? "pdf" : "epub";
  await check("download redirects to file", `/api/download/${bookId}?format=${format}`, {}, (res) => {
    fileUrl = res.headers.get("location");
    return res.status === 302 && fileUrl ? null : "no redirect";
  });
  if (fileUrl) {
    const path = fileUrl.replace(base, "");
    await check("file download headers", path, {}, (res) => {
      if (res.headers.get("content-type") !== (format === "pdf" ? "application/pdf" : "application/epub+zip")) return "wrong content-type";
      if (!(res.headers.get("content-disposition") ?? "").startsWith("attachment;")) return "not an attachment";
      return null;
    });
    await check("book files never render on our origin", path.split("?")[0], {}, (res) => {
      if (!(res.headers.get("content-disposition") ?? "").startsWith("attachment;")) return "inline without dl";
      if (!(res.headers.get("content-security-policy") ?? "").includes("sandbox")) return "no sandbox CSP";
      if (res.headers.get("cross-origin-resource-policy") !== "same-origin") return "no CORP";
      return null;
    });
    if (process.env.SMOKE_TRUSTED_PROXY === "1") {
      // Server started with TRUST_PROXY=1: each fake client IP gets its own budget.
      const headers = { "x-real-ip": "203.0.113.99" };
      let limited = false;
      for (let i = 0; i < 45 && !limited; i++) {
        const res = await fetch(`${base}/api/download/${bookId}?format=${format}`, { redirect: "manual", headers });
        limited = res.status === 429;
      }
      await check("download rate limit", `/api/download/${bookId}?format=${format}`, { headers: { "x-real-ip": "203.0.113.100" } }, (res) =>
        limited && res.status === 302 ? null : "no per-IP download limit",
      );
    }
    await check("file range request", path, { headers: { range: "bytes=0-3" } }, (res, body) =>
      res.status === 206 && res.headers.get("content-range")?.startsWith("bytes 0-3/") && /^(PK|%PDF)/.test(body) ? null : "range not honoured",
    );
  }
}

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
