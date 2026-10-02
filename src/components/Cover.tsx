// Book cover: the real image when we have one, otherwise a typographic
// cover in a stable color. No hooks, so it works in server and client code.
import { cn } from "@/lib/site";

// Walnut and beige shades, to match the site.
const PALETTE: [bg: string, fg: string, accent: string][] = [
  ["#5b3a22", "#f6ecdc", "#d9b48a"],
  ["#7a4b24", "#fbf1e2", "#ecc99c"],
  ["#3f2c1c", "#f3e8d8", "#c99a6a"],
  ["#8b6a4a", "#fff8ee", "#f3dcb8"],
  ["#4a3426", "#f5ebdd", "#d9ab78"],
  ["#6b4a2f", "#faf1e4", "#e3c08f"],
  ["#2f241b", "#efe3d0", "#c9a27a"],
  ["#9a6b3f", "#fffaf2", "#f6e2c3"],
];

interface CoverProps {
  id: number;
  title: string;
  author: string;
  coverUrl: string | null;
  className?: string;
  eager?: boolean;
}

export function Cover({ id, title, author, coverUrl, className, eager }: CoverProps) {
  const frame = cn("relative aspect-[2/3] w-full overflow-hidden rounded-lg", className);

  if (coverUrl) {
    return (
      <div className={cn(frame, "bg-surface-2")}>
        {/* Covers come from our own storage; next/image optimization isn't needed. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverUrl}
          alt={`غلاف ${title}`}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  const [bg, fg, accent] = PALETTE[Math.abs(id) % PALETTE.length];
  const size = title.length > 60 ? "text-[8cqw]" : title.length > 30 ? "text-[9.5cqw]" : "text-[11.5cqw]";
  return (
    <div role="img" aria-label={`غلاف ${title}`} className={cn(frame, "@container flex flex-col p-[10%]")} style={{ background: bg, color: fg }}>
      <span className="absolute inset-y-0 start-0 w-[5%] bg-black/20" aria-hidden="true" />
      <span className="h-[3px] w-[28%] rounded-full" style={{ background: accent }} aria-hidden="true" />
      <span dir="auto" className={cn("mt-[12%] line-clamp-6 font-bold leading-[1.35]", size)}>
        {title}
      </span>
      <span dir="auto" className="mt-auto line-clamp-2 text-[7.5cqw] leading-snug opacity-85">
        {author}
      </span>
      <span className="mt-[6%] h-px w-full opacity-40" style={{ background: accent }} aria-hidden="true" />
    </div>
  );
}
