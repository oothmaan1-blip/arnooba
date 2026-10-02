"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/site";

const LINKS = [
  { href: "/", label: "الرئيسية" },
  { href: "/ar", label: "كتب عربية" },
  { href: "/en", label: "كتب إنكليزية" },
  { href: "/shelf", label: "رفّي" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="الأقسام" className="hidden items-center gap-1 md:flex">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={isActive(pathname, link.href) ? "page" : undefined}
          className={cn(
            "rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-ink",
            isActive(pathname, link.href) && "bg-surface-2 text-ink",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [closedFor, setClosedFor] = useState(pathname);

  // Close the menu after navigating (adjusting state during render, per React docs).
  if (closedFor !== pathname) {
    setClosedFor(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        className="btn-ghost h-10 w-10 p-0"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "إغلاق القائمة" : "القائمة"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
      </button>
      {open && (
        <nav id="mobile-menu" aria-label="الأقسام" className="absolute inset-x-0 top-full border-b border-line bg-bg px-4 pb-4 shadow-lg">
          <ul className="flex flex-col gap-1 pt-2">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive(pathname, link.href) ? "page" : undefined}
                  className={cn(
                    "block rounded-xl px-4 py-3 text-base font-medium",
                    isActive(pathname, link.href) ? "bg-surface-2 text-ink" : "text-muted",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
