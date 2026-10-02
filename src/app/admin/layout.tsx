import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { BrandMark } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { logoutAction } from "@/lib/actions/admin";
import { isAdmin } from "@/lib/auth";
import { countOpenReports } from "@/lib/reports";

export const metadata: Metadata = {
  title: { default: "لوحة التحكم", template: "%s | لوحة تحكم أرنوبة" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin();
  const openReports = admin ? await countOpenReports() : 0;
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href="/admin" className="flex shrink-0 items-center gap-2 font-bold">
            <BrandMark className="h-9" sizes="40px" />
            <span className="hidden sm:inline">لوحة التحكم</span>
          </Link>
          <div className="ms-auto flex items-center gap-1">
            <Link href="/" className="btn-ghost text-muted">
              عرض الموقع
            </Link>
            <ThemeToggle />
            {admin && (
              <form action={logoutAction}>
                <button type="submit" className="btn-ghost text-muted">
                  خروج
                </button>
              </form>
            )}
          </div>
        </div>
        {admin && (
          <div className="mx-auto max-w-6xl px-4 pb-2">
            <AdminNav openReports={openReports} />
          </div>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
