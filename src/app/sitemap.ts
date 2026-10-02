import type { MetadataRoute } from "next";
import { sitemapEntries } from "@/lib/books";
import { bookPath } from "@/lib/paths";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const books = await sitemapEntries();
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/ar`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/en`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/about`, changeFrequency: "yearly", priority: 0.3 },
    ...books.map((book) => ({
      url: `${base}${encodeURI(bookPath(book))}`,
      lastModified: book.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
