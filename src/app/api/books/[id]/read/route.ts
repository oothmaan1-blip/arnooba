import { clientIp } from "@/lib/auth";
import { bumpCounter } from "@/lib/books";
import { rateLimit } from "@/lib/rate-limit";
import { UNKNOWN_IP } from "@/lib/ip";
import { isLikelyBot } from "@/lib/request";
import { parseIdParam } from "@/lib/text";

export async function POST(req: Request, ctx: RouteContext<"/api/books/[id]/read">) {
  const id = parseIdParam((await ctx.params).id);
  if (!id) return new Response(null, { status: 404 });
  const ip = await clientIp();
  if (!isLikelyBot(req) && (ip === UNKNOWN_IP || rateLimit(`read:${ip}:${id}`, 3, 60 * 60 * 1000))) {
    await bumpCounter(id, "reads").catch((err) => console.error("[read] counter failed:", err));
  }
  return new Response(null, { status: 204 });
}
