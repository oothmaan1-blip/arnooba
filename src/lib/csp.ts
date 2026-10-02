// Content-Security-Policy for HTML pages. Scripts need this request's nonce
// ('strict-dynamic' lets those scripts load the app's chunks), so injected
// markup cannot run JavaScript. Styles stay 'unsafe-inline': React style
// attributes and epub.js themes need it, and CSS cannot execute code.

function storageOrigins(env: NodeJS.ProcessEnv): string {
  return [env.S3_PUBLIC_URL, env.S3_ENDPOINT]
    .map((value) => {
      try {
        return value ? new URL(value).origin : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .join(" ");
}

export function servedOverHttps(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.VERCEL) || (env.SITE_URL ?? "").startsWith("https://");
}

export function buildCsp(nonce: string, env: NodeJS.ProcessEnv = process.env): string {
  const dev = env.NODE_ENV !== "production";
  const storage = storageOrigins(env);
  return [
    "default-src 'self'",
    // 'wasm-unsafe-eval': pdf.js decodes some images with WebAssembly.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' blob:",
    ["img-src 'self' data: blob:", storage].filter(Boolean).join(" "),
    "font-src 'self' data: blob:",
    ["connect-src 'self'", storage, dev ? "ws: wss:" : ""].filter(Boolean).join(" "),
    "worker-src 'self' blob:",
    "frame-src 'self' blob:",
    "media-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(servedOverHttps(env) ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/** For responses that are never HTML pages: files and JSON. */
export const LOCKED_DOWN_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
