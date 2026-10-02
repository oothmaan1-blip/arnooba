import { Search } from "lucide-react";
import { cn } from "@/lib/site";

export function SearchForm({
  defaultValue,
  large = false,
  className,
  id = "q",
}: {
  defaultValue?: string;
  large?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <form action="/search" role="search" className={cn("relative w-full", className)}>
      <label htmlFor={id} className="sr-only">
        ابحث عن كتاب أو مؤلف
      </label>
      <Search
        className={cn("pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-muted", large ? "h-5 w-5" : "h-4 w-4")}
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="ابحث عن كتاب أو مؤلف…"
        maxLength={200}
        autoComplete="off"
        enterKeyHint="search"
        className={cn("input", large ? "h-14 rounded-2xl ps-11 text-base shadow-sm" : "h-10 ps-10")}
      />
    </form>
  );
}
