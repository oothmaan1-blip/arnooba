import type { Metadata } from "next";
import { BookForm } from "@/components/admin/BookForm";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "إضافة كتاب" };

export default async function NewBookPage() {
  await requireAdmin();
  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">إضافة كتاب</h1>
      <p className="mb-6 text-sm text-muted">اختر ملف PDF أو EPUB وسنقرأ منه العنوان والمؤلف وعدد الصفحات والغلاف تلقائياً.</p>
      <BookForm
        initial={{
          lang: "ar",
          title: "",
          author: "",
          description: "",
          category: "literature",
          year: "",
          source: "",
          sourceUrl: "",
          license: "public-domain",
          film: "",
          complete: false,
          published: true,
          pages: null,
          current: { pdf: null, epub: null, cover: null },
        }}
      />
    </div>
  );
}
