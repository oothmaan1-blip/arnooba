import type { Metadata } from "next";
import { ShelfView } from "@/components/ShelfView";

export const metadata: Metadata = {
  title: "رفّي",
  robots: { index: false, follow: true },
};

export default function ShelfPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold">رفّي</h1>
      <p className="mt-2 text-muted">الكتب التي بدأت قراءتها والكتب التي حفظتها، بدون حساب ولا تسجيل.</p>
      <div className="mt-8">
        <ShelfView />
      </div>
    </div>
  );
}
