import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { adminConfigured, isAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="text-2xl font-bold">دخول المشرف</h1>
      <p className="mt-2 text-sm text-muted">هذه الصفحة لإدارة الكتب فقط. زوّار الموقع لا يحتاجون حساباً.</p>
      {adminConfigured() ? (
        <LoginForm />
      ) : (
        <p className="card mt-6 p-4 text-sm leading-7">
          لوحة التحكم غير مفعّلة بعد. أضف <code dir="ltr">ADMIN_PASSWORD</code> (12 حرفاً على الأقل) و
          <code dir="ltr">SESSION_SECRET</code> (32 حرفاً على الأقل) إلى متغيرات البيئة ثم أعد تشغيل الموقع.
        </p>
      )}
    </div>
  );
}
