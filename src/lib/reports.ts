import { sql } from "./db";
import type { ReportReason } from "./reports-shared";

export { isReportReason, reasonLabel, REPORT_REASONS, type ReportReason } from "./reports-shared";

export interface Report {
  id: number;
  bookId: number | null;
  bookTitle: string | null;
  bookPublished: boolean | null;
  reason: string;
  details: string;
  contact: string;
  status: "open" | "resolved";
  createdAt: Date;
}

export async function createReport(input: {
  bookId: number;
  reason: ReportReason;
  details: string;
  contact: string;
}): Promise<void> {
  await sql("INSERT INTO reports (book_id, reason, details, contact) VALUES ($1, $2, $3, $4)", [
    input.bookId,
    input.reason,
    input.details,
    input.contact,
  ]);
}

export async function listReports(status: "open" | "resolved" | "all" = "open"): Promise<Report[]> {
  const rows = await sql<{
    id: number;
    book_id: number | null;
    title: string | null;
    published: boolean | null;
    reason: string;
    details: string;
    contact: string;
    status: "open" | "resolved";
    created_at: Date | string;
  }>(
    `SELECT r.id, r.book_id, b.title, b.published, r.reason, r.details, r.contact, r.status, r.created_at
     FROM reports r LEFT JOIN books b ON b.id = r.book_id
     ${status === "all" ? "" : "WHERE r.status = $1"}
     ORDER BY r.created_at DESC LIMIT 200`,
    status === "all" ? [] : [status],
  );
  return rows.map((r) => ({
    id: r.id,
    bookId: r.book_id,
    bookTitle: r.title,
    bookPublished: r.published,
    reason: r.reason,
    details: r.details,
    contact: r.contact,
    status: r.status,
    createdAt: new Date(r.created_at),
  }));
}

export async function setReportStatus(id: number, status: "open" | "resolved"): Promise<void> {
  await sql("UPDATE reports SET status = $1 WHERE id = $2", [status, id]);
}

export async function deleteReport(id: number): Promise<void> {
  await sql("DELETE FROM reports WHERE id = $1", [id]);
}

export async function countOpenReports(): Promise<number> {
  const [row] = await sql<{ n: number }>("SELECT COUNT(*)::int AS n FROM reports WHERE status = 'open'");
  return row?.n ?? 0;
}
