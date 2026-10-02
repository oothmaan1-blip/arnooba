import Link from "next/link";
import type { SortKey } from "@/lib/books";
import { CATEGORIES, type CategoryId, type Lang } from "@/lib/categories";
import { langPath } from "@/lib/paths";
import { cn } from "@/lib/site";

export function CategoryChips({
  lang,
  counts,
  active,
  sort,
}: {
  lang: Lang;
  counts: Partial<Record<CategoryId, number>>;
  active?: CategoryId;
  sort?: SortKey;
}) {
  const present = CATEGORIES.filter((c) => counts[c.id]);
  if (present.length < 2) return null;
  const keepSort = sort && sort !== "popular" ? sort : undefined;
  return (
    <nav aria-label="التصنيفات" className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      <ul className="flex w-max gap-2">
        <li>
          <Link href={langPath(lang, { sort: keepSort })} className={cn("chip", !active && "chip-active")} aria-current={!active ? "page" : undefined}>
            الكل
          </Link>
        </li>
        {present.map((c) => (
          <li key={c.id}>
            <Link
              href={langPath(lang, { category: c.id, sort: keepSort })}
              className={cn("chip", active === c.id && "chip-active")}
              aria-current={active === c.id ? "page" : undefined}
            >
              {c.ar}
              <span className="text-xs opacity-70">{counts[c.id]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
