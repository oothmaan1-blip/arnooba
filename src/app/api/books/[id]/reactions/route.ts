import { createHash } from "node:crypto";
import { clientIp } from "@/lib/auth";
import { getBook } from "@/lib/books";
import { sql } from "@/lib/db";
import { isLikelyBot, isSameOrigin, json } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { parseIdParam } from "@/lib/text";

export const dynamic = "force-dynamic";

const REACTIONS = ["like", "exciting", "moving", "shock"] as const;
type Reaction = (typeof REACTIONS)[number];
type ReactionRow = { chapter_key: string; reaction: Reaction; count: number };

async function countsFor(bookId: number) {
  const rows = await sql<ReactionRow>(
    `SELECT chapter_key, reaction, COUNT(*)::int AS count
     FROM chapter_reactions WHERE book_id = $1
     GROUP BY chapter_key, reaction ORDER BY chapter_key`,
    [bookId],
  );
  const counts: Record<string, Partial<Record<Reaction, number>>> = {};
  for (const row of rows) {
    (counts[row.chapter_key] ??= {})[row.reaction] = row.count;
  }
  return counts;
}

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Context) {
  const id = parseIdParam((await ctx.params).id);
  if (!id || !(await getBook(id))) return json({ error: "not found" }, 404);
  const ip = await clientIp();
  if (!rateLimit(`reactions-read:${ip}`, 90, 60_000)) return json({ error: "slow down" }, 429);
  return json({ counts: await countsFor(id) });
}

export async function POST(req: Request, ctx: Context) {
  const id = parseIdParam((await ctx.params).id);
  if (!id || !(await getBook(id))) return json({ error: "not found" }, 404);
  if (!isSameOrigin(req) || isLikelyBot(req)) return json({ error: "forbidden" }, 403);
  const ip = await clientIp();
  if (!rateLimit(`reaction-write:${ip}`, 30, 60 * 60 * 1000)) return json({ error: "slow down" }, 429);

  let body: { chapterKey?: unknown; visitorId?: unknown; reaction?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad request" }, 400);
  }
  const chapterKey = typeof body.chapterKey === "string"
    ? body.chapterKey.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 180)
    : "";
  const visitorId = typeof body.visitorId === "string" ? body.visitorId : "";
  if (!chapterKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitorId)) {
    return json({ error: "invalid reaction" }, 400);
  }
  if (typeof body.reaction !== "string" || !REACTIONS.includes(body.reaction as Reaction)) {
    return json({ error: "invalid reaction" }, 400);
  }

  const visitorHash = createHash("sha256").update(visitorId).digest("hex");
  const saved = await sql<{ book_id: number }>(
    `INSERT INTO chapter_reactions (book_id, chapter_key, visitor_hash, reaction)
     SELECT id, $2, $3, $4 FROM books WHERE id = $1 AND published
     ON CONFLICT (book_id, chapter_key, visitor_hash)
     DO UPDATE SET reaction = EXCLUDED.reaction, updated_at = now()
     RETURNING book_id`,
    [id, chapterKey, visitorHash, body.reaction],
  );
  if (!saved.length) return json({ error: "not found" }, 404);
  return json({ counts: await countsFor(id) });
}
