// Single-admin auth with server-side sessions.
//  - The password comes from the environment; the cookie holds a random
//    256-bit token and only its SHA-256 is stored, so a database leak does not
//    leak usable sessions.
//  - Sessions expire after 12 hours, or 2 hours idle, can be revoked (logout,
//    "sign out everywhere"), and die when ADMIN_PASSWORD changes.
//  - Failed logins are counted in the database, so throttling holds across
//    serverless instances, and every security event lands in the audit log.
// Every admin page, route and action checks the session itself; nothing relies
// on the proxy.
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { sql } from "./db";
import { ipAllowed, pickClientIp } from "./ip";
import { passwordMatches, sign, verifyToken } from "./token";

const SECURE_COOKIES = process.env.NODE_ENV === "production";
// "__Host-" makes browsers refuse the cookie unless it is Secure, host-only and Path=/.
const COOKIE = SECURE_COOKIES ? "__Host-arnooba_admin" : "arnooba_admin";
const SESSION_HOURS = 12;
const IDLE_MINUTES = 120;
const FAILURE_WINDOW_MINUTES = 15;
const MAX_FAILURES_PER_IP = 5;
const SLOWDOWN_AFTER_GLOBAL_FAILURES = 50;

interface Secrets {
  password: string;
  secret: string;
}

function secrets(): Secrets | null {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const secret = process.env.SESSION_SECRET ?? "";
  if (password.length < 12 || secret.length < 32) return null;
  return { password, secret };
}

export function adminConfigured(): boolean {
  return secrets() !== null;
}

/** Changes whenever ADMIN_PASSWORD or SESSION_SECRET changes. */
function passwordVersion(s: Secrets): string {
  return sign(s.secret, `password-version.${s.password}`).slice(0, 22);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function clientIp(): Promise<string> {
  return pickClientIp(await headers());
}

export async function audit(event: string, detail = "", ip?: string): Promise<void> {
  try {
    await sql("INSERT INTO audit_log (event, ip, detail) VALUES ($1, $2, $3)", [
      event,
      ip ?? (await clientIp()),
      detail.slice(0, 500),
    ]);
  } catch (err) {
    console.error("[audit] failed to record", event, err);
  }
}

/** The current admin session, validated once per request. */
export const currentSession = cache(async (): Promise<{ id: string } | null> => {
  const s = secrets();
  if (!s) return null;
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  if (!ipAllowed(await clientIp())) return null;
  const id = hashToken(token);
  const [row] = await sql<{ pw_version: string; last_seen_at: Date | string }>(
    `SELECT pw_version, last_seen_at FROM admin_sessions
     WHERE id = $1 AND expires_at > now() AND last_seen_at > now() - make_interval(mins => $2)`,
    [id, IDLE_MINUTES],
  );
  if (!row || row.pw_version !== passwordVersion(s)) return null;
  if (Date.now() - new Date(row.last_seen_at).getTime() > 60_000) {
    await sql("UPDATE admin_sessions SET last_seen_at = now() WHERE id = $1", [id]);
  }
  return { id };
});

export async function isAdmin(): Promise<boolean> {
  return (await currentSession()) !== null;
}

/** For pages: bounce to the login screen. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

export type LoginResult = "ok" | "wrong" | "locked" | "unconfigured";

export async function startSession(password: string): Promise<LoginResult> {
  const s = secrets();
  if (!s) return "unconfigured";
  const ip = await clientIp();
  if (!ipAllowed(ip)) {
    await audit("login_blocked_ip", "", ip);
    await delay(700);
    return "wrong";
  }

  const [counts] = await sql<{ ip_failures: number; all_failures: number }>(
    `SELECT COUNT(*) FILTER (WHERE ip = $1)::int AS ip_failures, COUNT(*)::int AS all_failures
     FROM audit_log WHERE event = 'login_failed' AND at > now() - make_interval(mins => $2)`,
    [ip, FAILURE_WINDOW_MINUTES],
  );
  if ((counts?.ip_failures ?? 0) >= MAX_FAILURES_PER_IP) {
    await audit("login_locked", "", ip);
    return "locked";
  }
  // Many failures from many addresses: slow everyone down instead of locking
  // the real admin out.
  if ((counts?.all_failures ?? 0) >= SLOWDOWN_AFTER_GLOBAL_FAILURES) await delay(3000);

  if (!passwordMatches(s.secret, password, s.password)) {
    await audit("login_failed", "", ip);
    await delay(700);
    return "wrong";
  }

  const token = randomBytes(32).toString("base64url");
  const userAgent = ((await headers()).get("user-agent") ?? "").slice(0, 200);
  await sql(
    `INSERT INTO admin_sessions (id, pw_version, ip, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(hours => $5))`,
    [hashToken(token), passwordVersion(s), ip, userAgent, SESSION_HOURS],
  );
  await sql(
    "DELETE FROM admin_sessions WHERE expires_at < now() OR last_seen_at < now() - make_interval(mins => $1)",
    [IDLE_MINUTES],
  );
  await sql("DELETE FROM audit_log WHERE at < now() - interval '90 days'");
  await audit("login_ok", userAgent, ip);

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: SECURE_COOKIES,
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
  return "ok";
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await sql("DELETE FROM admin_sessions WHERE id = $1", [hashToken(token)]);
    await audit("logout");
  }
  jar.delete(COOKIE);
}

/** Revokes every admin session, including stolen ones. */
export async function endAllSessions(): Promise<void> {
  await sql("DELETE FROM admin_sessions");
  await audit("logout_all");
  (await cookies()).delete(COOKIE);
}

export async function securityOverview() {
  const [[stats], events] = await Promise.all([
    sql<{ failed_24h: number; active_sessions: number; locked_24h: number }>(
      `SELECT
         (SELECT COUNT(*)::int FROM audit_log WHERE event = 'login_failed' AND at > now() - interval '24 hours') AS failed_24h,
         (SELECT COUNT(*)::int FROM audit_log WHERE event = 'login_locked' AND at > now() - interval '24 hours') AS locked_24h,
         (SELECT COUNT(*)::int FROM admin_sessions WHERE expires_at > now()
            AND last_seen_at > now() - make_interval(mins => $1)) AS active_sessions`,
      [IDLE_MINUTES],
    ),
    sql<{ at: Date | string; event: string; ip: string; detail: string }>(
      "SELECT at, event, ip, detail FROM audit_log ORDER BY at DESC LIMIT 25",
    ),
  ]);
  return { ...stats, events: events.map((e) => ({ ...e, at: new Date(e.at) })) };
}

export function uploadTokenValid(key: string, token: string | null): boolean {
  const s = secrets();
  return !!s && verifyToken(s.secret, `upload:${key}`, token);
}
