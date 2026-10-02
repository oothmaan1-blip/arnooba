import type { NextConfig } from "next";
import { LOCKED_DOWN_CSP, servedOverHttps } from "./src/lib/csp";

// Pages get a per-request nonce CSP from src/proxy.ts; everything else gets
// these headers.
const baseHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), bluetooth=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  ...(servedOverHttps() ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // PGlite ships WebAssembly files it loads from its own package directory.
  serverExternalPackages: ["@electric-sql/pglite"],
  // The cover drawer reads its fonts at runtime; the admin pages run imports.
  outputFileTracingIncludes: { "/admin/**": ["./assets/fonts/*"] },
  async headers() {
    return [
      { source: "/:path*", headers: baseHeaders },
      // Book files: never rendered as a document on our origin.
      { source: "/files/:path*", headers: [{ key: "Content-Security-Policy", value: `${LOCKED_DOWN_CSP}; sandbox` }] },
      {
        source: "/api/:path*",
        headers: [
          { key: "Content-Security-Policy", value: LOCKED_DOWN_CSP },
          { key: "X-Robots-Tag", value: "noindex" },
        ],
      },
    ];
  },
};

export default nextConfig;
