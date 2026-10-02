// Small HMAC helpers for the admin session cookie and upload URLs.
import { createHmac, timingSafeEqual } from "node:crypto";

export function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** `<expiry>.<signature>` bound to a scope, e.g. "admin" or "upload:<key>". */
export function makeToken(secret: string, scope: string, ttlSeconds: number, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + ttlSeconds;
  return `${exp}.${sign(secret, `${scope}.${exp}`)}`;
}

export function verifyToken(secret: string, scope: string, token: string | undefined | null, now = Date.now()): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !/^\d{1,12}$/.test(parts[0]) || !parts[1]) return false;
  const exp = Number(parts[0]);
  if (exp * 1000 < now) return false;
  return safeEqual(parts[1], sign(secret, `${scope}.${exp}`));
}

/** Compares passwords through HMAC so the comparison is constant-time. */
export function passwordMatches(secret: string, input: string, expected: string): boolean {
  return safeEqual(sign(secret, `pw.${input}`), sign(secret, `pw.${expected}`));
}
