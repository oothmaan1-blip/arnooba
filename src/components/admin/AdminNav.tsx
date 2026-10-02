"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/site";

const LINKS = [
  { href: "/admin", label: "الرئيسية", exact: true },
  { href: "/admin/books", label: "الكتب" },
  { href: "/admin/books/new", label: "إضافة كتاب", exact: true },
  { href: "/admin/import", label: "استيراد" },
  { href: "/admin/reports", label: "البلاغات" },
];

export function AdminNav({ openReports }: { openReports: number }) {
  const pathname = usePathname();
  const active = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || (pathname.startsWith(`${href}/`) && !pathname.startsWith("/admin/books/new"));
  return (
    <nav aria-label="أقسام لوحة التحكم" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul className="flex w-max gap-1 text-sm">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={active(link.href, link.exact) ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-medium text-muted hover:text-ink",
                active(link.href, link.exact) && "bg-surface-2 text-ink",
              )}
            >
              {link.label}
              {link.href === "/admin/reports" && openReports > 0 && (
                <span className="rounded-full bg-accent px-1.5 text-xs text-on-accent">{openReports}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
