import Link from "next/link";
import { Search } from "lucide-react";
import { Logo } from "./Logo";
import { MobileMenu, NavLinks } from "./NavLinks";
import { SearchForm } from "./SearchForm";
import { ThemeToggle } from "./ThemeToggle";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/75">
      <div className="relative mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" aria-label="أرنوبة، الصفحة الرئيسية" className="shrink-0 rounded-lg">
          <Logo />
        </Link>
        <NavLinks />
        <div className="ms-auto hidden w-72 lg:block">
          <SearchForm id="header-q" />
        </div>
        <Link href="/search" className="btn-ghost ms-auto h-10 w-10 p-0 lg:hidden" aria-label="بحث">
          <Search className="h-5 w-5" aria-hidden="true" />
        </Link>
        <ThemeToggle />
        <MobileMenu />
      </div>
    </header>
  );
}
