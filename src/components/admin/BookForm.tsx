"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FileText, ImageIcon, LoaderCircle, Trash2, Upload } from "lucide-react";
import { deleteBookAction, saveBookAction, type BookPayload } from "@/lib/actions/admin";
import { CATEGORIES, LICENSES, type CategoryId, type Lang } from "@/lib/categories";
import { cn } from "@/lib/site";
import { formatBytes } from "@/lib/text";
import { ActiveContentError, inspectEpub, inspectPdf, toJpeg, uploadFiles, type FileInsights, type Slot } from "./book-files";

export interface BookFormInitial {
  id?: number;
  lang: Lang;
  title: string;
  author: string;
  description: string;
  category: CategoryId;
  year: string;
  source: string;
  sourceUrl: string;
  license: string;
  film: string;
  complete: boolean;
  published: boolean;
  pages: number | null;
  publicHref?: string;
  current: {
    pdf: { url: string; size: number | null } | null;
    epub: { url: string; size: number | null } | null;
    cover: { url: string } | null;
  };
}

type Fields = Omit<BookFormInitial, "id" | "current" | "publicHref" | "pages"> & { pages: string };

interface Picked {
  blob: Blob;
  name: string;
  auto?: boolean;
}

const SLOT_LABEL: Record<Slot, string> = { pdf: "PDF", epub: "EPUB", cover: "الغلاف" };

export function BookForm({ initial, saved }: { initial: BookFormInitial; saved?: boolean }) {
  const router = useRouter();
  const [fields, setFields] = useState<Fields>({ ...initial, pages: initial.pages ? String(initial.pages) : "" });
  const [picked, setPicked] = useState<Partial<Record<Slot, Picked>>>({});
  const [removed, setRemoved] = useState<Partial<Record<Slot, boolean>>>({});
  const [busy, setBusy] = useState<"idle" | "reading" | "uploading" | "saving" | "deleting">("idle");
  const [progress, setProgress] = useState<Partial<Record<Slot, number>>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(saved ? "تم الحفظ." : null);

  const coverPreview = useMemo(() => (picked.cover ? URL.createObjectURL(picked.cover.blob) : null), [picked.cover]);
  useEffect(() => () => void (coverPreview && URL.revokeObjectURL(coverPreview)), [coverPreview]);

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => setFields((f) => ({ ...f, [key]: value }));

  function prefill(info: FileInsights) {
    setFields((f) => ({
      ...f,
      title: f.title || info.title || "",
      author: f.author || info.author || "",
      description: f.description || info.description || "",
      pages: info.pages ? String(info.pages) : f.pages,
      lang: !f.title && info.language?.toLowerCase().startsWith("en") ? "en" : f.lang,
    }));
    if (info.cover) {
      setPicked((p) =>
        p.cover && !p.cover.auto ? p : initial.current.cover && !removed.cover ? p : { ...p, cover: { blob: info.cover!, name: "cover.jpg", auto: true } },
      );
    }
  }

  async function choose(slot: Slot, file: File | undefined) {
    setError(null);
    setNotice(null);
    if (!file) return;
    if (slot === "cover") {
      setBusy("reading");
      try {
        setPicked((p) => ({ ...p, cover: { blob: file, name: file.name } }));
        const jpeg = await toJpeg(file);
        setPicked((p) => ({ ...p, cover: { blob: jpeg, name: file.name } }));
      } catch {
        setError("تعذّر قراءة الصورة. جرّب JPG أو PNG.");
        setPicked((p) => ({ ...p, cover: undefined }));
      } finally {
        setBusy("idle");
      }
      return;
    }
    setPicked((p) => ({ ...p, [slot]: { blob: file, name: file.name } }));
    setRemoved((r) => ({ ...r, [slot]: false }));
    setBusy("reading");
    try {
      prefill(slot === "pdf" ? await inspectPdf(file) : await inspectEpub(file));
    } catch (err) {
      setError(
        err instanceof ActiveContentError
          ? err.message
          : slot === "pdf"
            ? "تعذّر قراءة ملف PDF؛ تأكد أنه غير تالف."
            : "تعذّر قراءة ملف EPUB؛ تأكد أنه غير تالف.",
      );
      setPicked((p) => ({ ...p, [slot]: undefined }));
    } finally {
      setBusy("idle");
    }
  }

  const hasFile = (slot: "pdf" | "epub") => Boolean(picked[slot] || (initial.current[slot] && !removed[slot]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!fields.title.trim()) return setError("عنوان الكتاب مطلوب.");
    if (!hasFile("pdf") && !hasFile("epub")) return setError("أضف ملف PDF أو EPUB واحداً على الأقل.");

    try {
      const toUpload = (Object.entries(picked) as [Slot, Picked | undefined][])
        .filter((entry): entry is [Slot, Picked] => Boolean(entry[1]))
        .map(([slot, p]) => ({ slot, blob: p.blob }));
      let keys: Partial<Record<Slot, string>> = {};
      if (toUpload.length) {
        setBusy("uploading");
        keys = await uploadFiles(toUpload, { title: fields.title, author: fields.author }, (slot, ratio) =>
          setProgress((p) => ({ ...p, [slot]: ratio })),
        );
      }
      setBusy("saving");
      const fileChange = (slot: Slot) => (keys[slot] ? { key: keys[slot]! } : removed[slot] ? null : undefined);
      const payload: BookPayload = {
        id: initial.id,
        lang: fields.lang,
        title: fields.title,
        author: fields.author,
        description: fields.description,
        category: fields.category,
        year: fields.year,
        source: fields.source,
        sourceUrl: fields.sourceUrl,
        license: fields.license,
        film: fields.film,
        complete: fields.complete,
        published: fields.published,
        pages: fields.pages ? Number(fields.pages) : null,
        pdf: fileChange("pdf"),
        epub: fileChange("epub"),
        cover: fileChange("cover"),
      };
      const result = await saveBookAction(payload);
      if (!result.ok) {
        setError(result.error);
        setBusy("idle");
        return;
      }
      setPicked({});
      setRemoved({});
      setProgress({});
      setBusy("idle");
      if (initial.id) {
        setNotice("تم الحفظ.");
        router.refresh();
      } else {
        router.replace(`/admin/books/${result.id}?saved=1`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ غير متوقع.");
      setBusy("idle");
    }
  }

  async function remove() {
    if (!initial.id || !window.confirm("حذف هذا الكتاب وملفاته نهائياً؟")) return;
    setBusy("deleting");
    await deleteBookAction(initial.id);
    router.replace("/admin/books");
  }

  const working = busy !== "idle";
  const coverShown = coverPreview ?? (!removed.cover ? initial.current.cover?.url : null);

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <fieldset className="card grid gap-4 p-5 sm:grid-cols-2">
          <legend className="sr-only">بيانات الكتاب</legend>
          <div className="sm:col-span-2">
            <span className="label">اللغة</span>
            <div className="flex gap-2">
              {(["ar", "en"] as const).map((l) => (
                <label key={l} className="chip cursor-pointer has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent">
                  <input type="radio" name="lang" value={l} checked={fields.lang === l} onChange={() => set("lang", l)} className="sr-only" />
                  {l === "ar" ? "كتاب عربي" : "كتاب إنكليزي"}
                </label>
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="title" className="label">العنوان *</label>
            <input id="title" required maxLength={300} dir="auto" value={fields.title} onChange={(e) => set("title", e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="author" className="label">المؤلف</label>
            <input id="author" maxLength={200} dir="auto" value={fields.author} onChange={(e) => set("author", e.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor="category" className="label">التصنيف</label>
            <select id="category" value={fields.category} onChange={(e) => set("category", e.target.value as CategoryId)} className="input">
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.ar}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="description" className="label">نبذة عن الكتاب</label>
            <textarea id="description" rows={6} maxLength={6000} dir="auto" value={fields.description} onChange={(e) => set("description", e.target.value)} className="input leading-7" />
          </div>
          <div>
            <label htmlFor="pages" className="label">عدد الصفحات</label>
            <input id="pages" inputMode="numeric" pattern="[0-9]*" value={fields.pages} onChange={(e) => set("pages", e.target.value.replace(/\D/g, "").slice(0, 5))} className="input" />
          </div>
          <div>
            <label htmlFor="year" className="label">سنة النشر</label>
            <input id="year" maxLength={20} value={fields.year} onChange={(e) => set("year", e.target.value)} className="input" />
          </div>
        </fieldset>

        <fieldset className="card grid gap-4 p-5 sm:grid-cols-2">
          <legend className="sr-only">المصدر والرخصة</legend>
          <div>
            <label htmlFor="source" className="label">المصدر</label>
            <input id="source" maxLength={100} value={fields.source} onChange={(e) => set("source", e.target.value)} placeholder="مثلاً: مؤسسة هنداوي" className="input" />
          </div>
          <div>
            <label htmlFor="license" className="label">الرخصة</label>
            <select id="license" value={fields.license} onChange={(e) => set("license", e.target.value)} className="input">
              {LICENSES.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="sourceUrl" className="label">رابط المصدر</label>
            <input id="sourceUrl" type="url" maxLength={500} dir="ltr" value={fields.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} placeholder="https://" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="film" className="label">تحوّل إلى فيلم؟ (اختياري)</label>
            <input id="film" maxLength={200} value={fields.film} onChange={(e) => set("film", e.target.value)} placeholder="مثلاً: رحلة إلى مركز الأرض (2008)" className="input" />
          </div>
          <p className="text-xs leading-6 text-muted sm:col-span-2">
            انشر فقط كتباً في الملكية العامة، أو برخصة تسمح بإعادة النشر، أو بإذن مكتوب من صاحب الحقوق. لكتب هنداوي استعمل
            صفحة «استيراد»: تفحص رخصة كل كتاب تلقائياً (الكتب التي اشترت هنداوي حقوقها ممنوع إعادة نشرها). ولا تنقل من مواقع
            يرفع عليها المستخدمون (مثل مكتبة نور) أو منصات القراءة (مثل أبجد): إذن القراءة هناك لا يشمل موقعك.
          </p>
        </fieldset>
      </div>

      <aside className="space-y-5">
        <div className="card p-5">
          <p className="label">الغلاف</p>
          <div className="mx-auto w-40">
            {coverShown ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverShown} alt="معاينة الغلاف" className="aspect-[2/3] w-full rounded-lg object-cover ring-1 ring-line" />
            ) : (
              <div className="flex aspect-[2/3] w-full items-center justify-center rounded-lg bg-surface-2 text-center text-xs text-muted">
                سيُصنع غلاف تلقائي من العنوان
              </div>
            )}
          </div>
          {picked.cover?.auto && <p className="mt-2 text-center text-xs text-muted">مأخوذ من الصفحة الأولى للكتاب</p>}
          <div className="mt-3 flex justify-center gap-2">
            <label className="btn-secondary cursor-pointer text-xs">
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
              اختيار صورة
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => void choose("cover", e.target.files?.[0])} />
            </label>
            {(picked.cover || (initial.current.cover && !removed.cover)) && (
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => {
                  setPicked((p) => ({ ...p, cover: undefined }));
                  setRemoved((r) => ({ ...r, cover: Boolean(initial.current.cover) }));
                }}
              >
                إزالة
              </button>
            )}
          </div>
        </div>

        {(["pdf", "epub"] as const).map((slot) => {
          const current = initial.current[slot];
          const chosen = picked[slot];
          return (
            <div key={slot} className="card p-5">
              <p className="label">ملف {SLOT_LABEL[slot]}</p>
              {chosen ? (
                <p className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                  <span className="truncate" dir="auto">{chosen.name}</span>
                  <span dir="ltr" className="shrink-0 text-xs text-muted">{formatBytes(chosen.blob.size)}</span>
                </p>
              ) : current && !removed[slot] ? (
                <p className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                  <a href={current.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">الملف الحالي</a>
                  <span dir="ltr" className="text-xs text-muted">{formatBytes(current.size)}</span>
                </p>
              ) : (
                <p className="text-sm text-muted">{removed[slot] ? "سيُحذف عند الحفظ" : "لا يوجد ملف"}</p>
              )}
              {progress[slot] !== undefined && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.round((progress[slot] ?? 0) * 100)}%` }} />
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <label className="btn-secondary cursor-pointer text-xs">
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  {current || chosen ? "استبدال" : "اختيار ملف"}
                  <input
                    type="file"
                    accept={slot === "pdf" ? "application/pdf,.pdf" : "application/epub+zip,.epub"}
                    className="sr-only"
                    onChange={(e) => void choose(slot, e.target.files?.[0])}
                  />
                </label>
                {(chosen || (current && !removed[slot])) && (
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={() => {
                      setPicked((p) => ({ ...p, [slot]: undefined }));
                      setRemoved((r) => ({ ...r, [slot]: Boolean(current) }));
                    }}
                  >
                    إزالة
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <div className="card space-y-4 p-5">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={fields.published} onChange={(e) => set("published", e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
            منشور ويظهر للزوار
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={fields.complete} onChange={(e) => set("complete", e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
            <span>
              نسخة كاملة
              <span className="block text-xs text-muted">راجعتَ أن الكتاب كامل وليس عيّنة أو جزءاً منه؛ تظهر للزوار شارة «نسخة كاملة».</span>
            </span>
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          {notice && !error && (
            <p role="status" className="text-sm text-green-700 dark:text-green-400">
              {notice}{" "}
              {initial.publicHref && fields.published && (
                <Link href={initial.publicHref} className="underline">عرض الصفحة</Link>
              )}
            </p>
          )}
          <button type="submit" disabled={working} className="btn-primary w-full">
            {working && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy === "reading" ? "جارٍ قراءة الملف…" : busy === "uploading" ? "جارٍ الرفع…" : busy === "saving" ? "جارٍ الحفظ…" : initial.id ? "حفظ التعديلات" : "إضافة الكتاب"}
          </button>
          {initial.id && (
            <button type="button" onClick={remove} disabled={working} className={cn("btn-danger w-full")}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              حذف الكتاب
            </button>
          )}
        </div>
      </aside>
    </form>
  );
}
