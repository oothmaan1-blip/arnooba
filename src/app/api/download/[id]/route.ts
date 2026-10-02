import { clientIp } from "@/lib/auth";
import { bumpCounter, getBook } from "@/lib/books";
import { UNKNOWN_IP } from "@/lib/ip";
import { rateLimit } from "@/lib/rate-limit";
import { isLikelyBot } from "@/lib/request";
import { downloadUrl } from "@/lib/storage";
import { fileNameFor, parseIdParam } from "@/lib/text";

export async function GET(req: Request, ctx: RouteContext<"/api/download/[id]">) {
  const id = parseIdParam((await ctx.params).id);
  const format = new URL(req.url).searchParams.get("format");
  if (!id || (format !== "pdf" && format !== "epub")) return new Response("Not found", { status: 404 });

  const ip = await clientIp();
  if (ip !== UNKNOWN_IP && !rateLimit(`download:${ip}`, 40, 60_000)) {
    return new Response("Too many downloads, try again in a minute.", { status: 429, headers: { "Retry-After": "60" } });
  }

  const book = await getBook(id);
  const key = format === "pdf" ? book?.pdfKey : book?.epubKey;
  if (!book || !key) return new Response("Not found", { status: 404 });

  if (!isLikelyBot(req)) {
    await bumpCounter(book.id, "downloads").catch((err) => console.error("[download] counter failed:", err));
  }
  const target = new URL(downloadUrl(key, fileNameFor(book.title, book.author, format)), req.url);
  return new Response(null, {
    status: 302,
    headers: { Location: target.toString(), "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
