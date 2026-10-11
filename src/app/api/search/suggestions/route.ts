import { clientIp } from "@/lib/auth";
import { searchBooks } from "@/lib/books";
import { bookPath } from "@/lib/paths";
import { json } from "@/lib/request";
import { rateLimit } from "@/lib/rate-limit";
import { UNKNOWN_IP } from "@/lib/ip";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 200) ?? "";
  if ([...query].length < 2) return json({ suggestions: [] });

  const ip = await clientIp();
  if (ip !== UNKNOWN_IP && !rateLimit(`suggestions:${ip}`, 90, 60_000)) {
    return json({ suggestions: [] }, 429);
  }

  const [ar, en] = await Promise.all([
    searchBooks(query, { lang: "ar", pageSize: 5 }),
    searchBooks(query, { lang: "en", pageSize: 5 }),
  ]);
  const suggestions = [...ar.items, ...en.items].slice(0, 8).map((book) => ({
    id: book.id,
    title: book.title,
    author: book.author,
    lang: book.lang,
    href: bookPath(book),
  }));
  return json({ suggestions });
}
