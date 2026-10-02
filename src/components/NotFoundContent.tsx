import Link from "next/link";
import { BrandMark } from "./Logo";
import { SearchForm } from "./SearchForm";

export function NotFoundContent() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
      <BrandMark className="h-32" sizes="140px" />
      <h1 className="mt-5 text-2xl font-bold">هذه الصفحة غير موجودة</h1>
      <p className="mt-2 text-muted">ربما نُقل الكتاب أو كُتب الرابط بشكل خاطئ. جرّب البحث:</p>
      <SearchForm className="mt-6" id="nf-q" />
      <Link href="/" className="btn-secondary mt-6">
        العودة إلى الرئيسية
      </Link>
    </div>
  );
}
