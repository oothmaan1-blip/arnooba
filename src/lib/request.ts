const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|curl|wget|python-requests|headless/i;

export function isLikelyBot(req: Request): boolean {
  return BOT_UA.test(req.headers.get("user-agent") ?? "");
}

/**
 * State-changing admin routes must come from our own pages. Browsers always
 * send Origin on POST/PUT, so a missing or foreign Origin is rejected.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
