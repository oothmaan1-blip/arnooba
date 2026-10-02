import Image from "next/image";
import { cn } from "@/lib/site";
import mark from "../../assets/brand/arnooba-mark.png";

/**
 * The site's mascot picture (transparent background). next/image serves a
 * small WebP/AVIF at the displayed size; set the height with `className`.
 */
export function BrandMark({ className, priority = false, sizes = "48px" }: { className?: string; priority?: boolean; sizes?: string }) {
  return <Image src={mark} alt="" sizes={sizes} priority={priority} className={cn("w-auto select-none", className)} draggable={false} />;
}

export function Logo({ className, large = false }: { className?: string; large?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <BrandMark className={large ? "h-16" : "h-11"} sizes={large ? "72px" : "48px"} priority />
      <span className={cn("font-brand font-bold leading-none text-accent", large ? "text-5xl" : "text-2xl")}>أرنوبة</span>
    </span>
  );
}
