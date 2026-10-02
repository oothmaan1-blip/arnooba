// Runs before every page request: issues a fresh CSP nonce (Next.js applies it
// to its own scripts automatically) and hides the admin area from addresses
// outside ADMIN_ALLOWED_IPS. This is defense in depth only: admin pages,
// actions and routes still verify the session themselves.
import { NextResponse, type NextRequest } from "next/server";
import { buildCsp } from "@/lib/csp";
import { ipAllowed, pickClientIp } from "@/lib/ip";

export function proxy(request: NextRequest) {
  const isAdminArea = request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/");
  if (isAdminArea && !ipAllowed(pickClientIp(request.headers))) {
    return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (isAdminArea) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    response.headers.set("Cache-Control", "no-store");
  }
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: API routes, files and static assets get their headers from next.config.
      source: "/((?!api/|files/|pdfjs/|_next/static|_next/image|icon.png|apple-icon.png|robots.txt|sitemap.xml).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
