export const SITE_NAME = "أرنوبة";

export const SITE_DESCRIPTION =
  "أرنوبة مكتبة مجانية وقانونية: اقرأ الكتب العربية والإنكليزية أونلاين أو حمّلها بصيغة PDF وEPUB. روايات وأدب وتاريخ وفلسفة وأكثر.";

export function siteUrl(): string {
  const explicit = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
