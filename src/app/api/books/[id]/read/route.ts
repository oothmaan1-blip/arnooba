import { clientIp } from "@/lib/auth";
import { bumpCounter } from "@/lib/books";
import { sql } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { UNKNOWN_IP } from "@/lib/ip";
import { isLikelyBot } from "@/lib/request";
import { parseIdParam } from "@/lib/text";

export async function POST(req: Request, ctx: RouteContext<"/api/books/[id]/read">) {
  const id = parseIdParam((await ctx.params).id);
  if (!id) return new Response(null, { status: 404 });
  const ip = await clientIp();
  if (!isLikelyBot(req) && (ip === UNKNOWN_IP || rateLimit(`read:${ip}:${id}`, 3, 60 * 60 * 1000))) {
    await Promise.all([
      bumpCounter(id, "reads"),
      sql("INSERT INTO book_read_events (book_id) SELECT id FROM books WHERE id = $1 AND published", [id]),
    ]).catch((err) => console.error("[read] counter failed:", err));
    if (rateLimit("read-event-cleanup", 1, 12 * 60 * 60 * 1000)) {
      void sql("DELETE FROM book_read_events WHERE created_at < now() - interval '30 days'").catch((err) => console.error("[read] cleanup failed:", err));
    }
  }
  return new Response(null, { status: 204 });
}
