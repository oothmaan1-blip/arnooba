import type { Metadata } from "next";
import { ImportPanel } from "@/components/admin/ImportPanel";
import { requireAdmin } from "@/lib/auth";
import { sourceIdsWithPrefix } from "@/lib/books";
import { GUTENBERG_PICKS } from "@/lib/import/gutenberg-picks";
import { HINDAWI_PICKS } from "@/lib/import/hindawi-picks";
import { WIKISOURCE_STARTER } from "@/lib/import/wikisource-starter";

export const metadata: Metadata = { title: "استيراد كتب" };

// Imports download whole books; give the server actions on this page time.
export const maxDuration = 300;

export default async function ImportPage() {
  await requireAdmin();
  const [wikisourceIds, gutenbergIds, hindawiIds] = await Promise.all([
    sourceIdsWithPrefix("wikisource:ar:"),
    sourceIdsWithPrefix("gutenberg:"),
    sourceIdsWithPrefix("hindawi:"),
  ]);
  const imported = new Set([...wikisourceIds, ...gutenbergIds, ...hindawiIds]);
  const starter = WIKISOURCE_STARTER.map((entry) => ({
    page: entry.page,
    title: entry.title,
    author: entry.author,
    imported: imported.has(`wikisource:ar:${entry.page}`),
  }));
  const picks = GUTENBERG_PICKS.map((pick) => ({ ...pick, imported: imported.has(`gutenberg:${pick.id}`) }));
  const hindawi = HINDAWI_PICKS.map((pick) => ({
    id: pick.id,
    title: pick.title,
    category: pick.category,
    film: Boolean(pick.film),
    imported: imported.has(`hindawi:${pick.id}`),
  }));
  return (
    <div>
      <h1 className="text-2xl font-bold">استيراد كتب</h1>
      <p className="mt-1 text-sm text-muted">
        استورد كتباً في الملكية العامة بضغطة: العربية من مؤسسة هنداوي وويكي مصدر، والإنكليزية من Project Gutenberg.
      </p>
      <ImportPanel starter={starter} picks={picks} hindawi={hindawi} />
    </div>
  );
}
