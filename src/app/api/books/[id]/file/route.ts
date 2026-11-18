import { getBook } from "@/lib/books";
import { parseIdParam } from "@/lib/text";
import { publicUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Context) {
  const id = parseIdParam((await ctx.params).id);
  const format = new URL(req.url).searchParams.get("format");
  const book = id ? await getBook(id) : null;
  const key = format === "pdf" ? book?.pdfKey : format === "epub" ? book?.epubKey : null;
  if (!key) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  return Response.redirect(new URL(publicUrl(key), req.url), 302);
}
