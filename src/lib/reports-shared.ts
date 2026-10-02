// Report reasons, shared by the public form (client) and the server.
export const REPORT_REASONS = [
  { id: "copyright", label: "انتهاك حقوق نشر" },
  { id: "incomplete", label: "الكتاب ناقص (صفحات أو فصول مفقودة)" },
  { id: "broken", label: "الملف لا يفتح أو تالف" },
  { id: "wrong-info", label: "معلومات الكتاب خاطئة" },
  { id: "other", label: "سبب آخر" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["id"];

export function isReportReason(value: unknown): value is ReportReason {
  return REPORT_REASONS.some((r) => r.id === value);
}

export function reasonLabel(id: string): string {
  return REPORT_REASONS.find((r) => r.id === id)?.label ?? id;
}
