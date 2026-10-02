import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "عن أرنوبة",
  description: "من نحن، ومن أين تأتي الكتب، وكيف تبلّغ عن كتاب محمي بحقوق النشر.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 leading-8">
      <h1 className="text-3xl font-bold">عن أرنوبة</h1>
      <p className="mt-4 text-lg text-muted">
        أرنوبة مكتبة مجانية صغيرة تحب الكتب: تقرأ فيها أونلاين أو تحمّل الكتاب وتأخذه معك، بلا حساب وبلا اشتراك.
      </p>

      <h2 className="mt-10 text-xl font-bold">من أين تأتي الكتب؟</h2>
      <ul className="mt-3 list-disc space-y-2 ps-6">
        <li>
          <strong>الكتب الإنكليزية</strong> من{" "}
          <a className="text-accent hover:underline" href="https://www.gutenberg.org" target="_blank" rel="noopener noreferrer">
            Project Gutenberg
          </a>
          ، وننشر فقط الكتب التي توفي كل مؤلفيها ومترجميها قبل أكثر من ٧٠ سنة، حتى تكون في الملكية العامة في
          أغلب دول العالم وليس في أمريكا فقط.
        </li>
        <li>
          <strong>الكتب العربية</strong> من{" "}
          <a className="text-accent hover:underline" href="https://ar.wikisource.org" target="_blank" rel="noopener noreferrer">
            ويكي مصدر
          </a>{" "}
          (نصوص في الملكية العامة، والنسخة الرقمية برخصة المشاع الإبداعي CC BY-SA)، ومن مصادر تنشر كتبها برخص حرّة
          مثل CC BY 4.0، أو بإذن أصحابها.
        </li>
      </ul>
      <p className="mt-3">
        مصدر كل كتاب ورخصته مكتوبان في صفحته، مع رابط للمصدر الأصلي.
      </p>

      <h2 id="copyright" className="mt-10 scroll-mt-24 text-xl font-bold">
        حقوق النشر والبلاغات
      </h2>
      <p className="mt-3">
        نحترم حقوق المؤلفين والناشرين، ولا ننشر عن قصد أي كتاب محمي. إذا وجدت كتاباً لا يحق لنا نشره، افتح صفحة
        الكتاب واضغط <strong>«إبلاغ عن مشكلة»</strong> واختر «انتهاك حقوق نشر». نراجع كل بلاغ يدوياً ونخفي الكتاب
        فوراً عند ثبوت البلاغ.
      </p>

      <h2 className="mt-10 text-xl font-bold">خصوصيتك</h2>
      <p className="mt-3">
        لا توجد حسابات ولا تتبّع إعلاني. قائمة «رفّي» ومكان توقفك في القراءة محفوظان في متصفحك فقط. نحسب عدد مرات
        التحميل والقراءة لكل كتاب كرقم إجمالي، بدون أي معلومات عنك.
      </p>

      <p className="mt-12">
        <Link href="/" className="btn-primary">
          تصفّح الكتب
        </Link>
      </p>
    </article>
  );
}
