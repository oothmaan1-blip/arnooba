import Link from "next/link";
import { BrandMark } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[2fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <BrandMark className="h-12" sizes="56px" />
            <span className="font-brand text-xl font-bold text-accent">أرنوبة</span>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-7 text-muted">
            مكتبة مجانية لكتب في الملكية العامة أو برخص حرّة. الكتب الإنكليزية من Project Gutenberg، والعربية
            من ويكي مصدر ومصادر حرّة أخرى.
          </p>
        </div>
        <nav aria-label="روابط الموقع">
          <p className="text-sm font-semibold">المكتبة</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link className="hover:text-ink" href="/ar">كتب عربية</Link></li>
            <li><Link className="hover:text-ink" href="/en">كتب إنكليزية</Link></li>
            <li><Link className="hover:text-ink" href="/shelf">رفّي</Link></li>
          </ul>
        </nav>
        <nav aria-label="عن الموقع">
          <p className="text-sm font-semibold">عن أرنوبة</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><Link className="hover:text-ink" href="/about">من نحن</Link></li>
            <li><Link className="hover:text-ink" href="/about#copyright">حقوق النشر والبلاغات</Link></li>
          </ul>
        </nav>
      </div>
      <p className="border-t border-line py-4 text-center text-xs text-muted">
        أرنوبة {new Date().getFullYear()} · القراءة والتحميل مجاناً دائماً
      </p>
    </footer>
  );
}
