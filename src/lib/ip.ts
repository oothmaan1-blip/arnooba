// Client IP handling. Forwarding headers are trivially forged by a client, so
// they are only trusted behind a proxy that overwrites them (Vercel does; for
// nginx & co. set TRUST_PROXY=1). Pure functions; no Next.js imports.

export const UNKNOWN_IP = "unknown";

export function pickClientIp(headers: Headers, env: Record<string, string | undefined> = process.env): string {
  if (!env.VERCEL && env.TRUST_PROXY !== "1") return UNKNOWN_IP;
  const candidate = headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0];
  const ip = candidate?.trim() ?? "";
  return /^[0-9a-fA-F:.]{2,45}$/.test(ip) ? ip : UNKNOWN_IP;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return null;
    value = value * 256 + Number(part);
  }
  return value;
}

/** Exact IPs or IPv4 CIDR ranges, e.g. "203.0.113.7, 198.51.100.0/24". Empty list allows everyone. */
export function ipAllowed(ip: string, allowList: string | undefined = process.env.ADMIN_ALLOWED_IPS): boolean {
  const rules = (allowList ?? "")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  if (rules.length === 0) return true;
  const ipInt = ipv4ToInt(ip);
  return rules.some((rule) => {
    if (!rule.includes("/")) return rule === ip;
    const [base, bitsText] = rule.split("/");
    const baseInt = ipv4ToInt(base);
    const bits = Number(bitsText);
    if (ipInt === null || baseInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return ((ipInt & mask) >>> 0) === ((baseInt & mask) >>> 0);
  });
}
