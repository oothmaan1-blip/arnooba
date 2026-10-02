"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CircleCheck, LoaderCircle } from "lucide-react";
import {
  importGutenbergBatchAction,
  importGutenbergByIdAction,
  importHindawiAction,
  importHindawiPickAction,
  importStarterAction,
  importWikisourceAction,
  type ImportActionResult,
} from "@/lib/actions/admin";
import { CATEGORIES, categoryLabel, type CategoryId } from "@/lib/categories";
import { GUTENBERG_TOPICS, type GutenbergTopic } from "@/lib/import/gutenberg-topics";

interface StarterItem {
  page: string;
  title: string;
  author: string;
  imported: boolean;
}

interface LogLine {
  tone: "ok" | "info" | "error";
  text: string;
}

function describe(result: ImportActionResult): LogLine {
  if (!result.ok) return { tone: "error", text: result.error };
  if (result.status === "imported") return { tone: "ok", text: `أُضيف: ${result.title}` };
  if (result.status === "exists") return { tone: "info", text: `موجود مسبقاً: ${result.title}` };
  return { tone: "info", text: `تُرك: ${result.title} (${result.reason})` };
}

function Log({ lines }: { lines: LogLine[] }) {
  if (!lines.length) return null;
  return (
    <ol className="mt-4 max-h-64 space-y-1 overflow-y-auto rounded-xl bg-surface-2 p-3 text-xs leading-6" aria-live="polite">
      {lines.map((line, i) => (
        <li
          key={i}
          dir="auto"
          className={line.tone === "error" ? "text-red-600 dark:text-red-400" : line.tone === "ok" ? "text-green-700 dark:text-green-400" : "text-muted"}
        >
          {line.text}
        </li>
      ))}
    </ol>
  );
}

const PAGE_KEY = "arnooba:admin:gutenberg-page";

interface PickItem {
  id: number;
  title: string;
  imported: boolean;
}

function GutenbergImport({ picks }: { picks: PickItem[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(() => picks.filter((p) => !p.imported));
  const [count, setCount] = useState(24);
  const [topic, setTopic] = useState<GutenbergTopic>("");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [bookId, setBookId] = useState("");
  const stop = useRef(false);
  const log = (line: LogLine) => setLines((l) => [...l, line].slice(-200));

  async function runBatch() {
    stop.current = false;
    setRunning(true);
    setDone(0);
    setLines([]);
    let page = 1;
    try {
      page = Math.max(1, Number(localStorage.getItem(`${PAGE_KEY}:${topic}`)) || 1);
    } catch {
      // start from the first page
    }
    let imported = 0;
    let emptyPages = 0;
    while (imported < count && !stop.current) {
      const result = await importGutenbergBatchAction(page, Math.min(5, count - imported), topic);
      if (!result.ok) {
        log({ tone: "error", text: result.error });
        break;
      }
      for (const book of result.imported) log({ tone: "ok", text: `أُضيف: ${book.title}` });
      for (const failure of result.failed) log({ tone: "error", text: `فشل: ${failure.title} (${failure.reason})` });
      imported += result.imported.length;
      setDone(imported);
      emptyPages = result.imported.length ? 0 : emptyPages + 1;
      if (result.nextPage === null) {
        log({ tone: "info", text: "وصلنا إلى نهاية القائمة." });
        break;
      }
      if (result.nextPage !== page) log({ tone: "info", text: `الصفحة ${page}: ${result.existing} موجود مسبقاً، ${result.skipped} متروك لأسباب الحقوق أو الصيغة.` });
      page = result.nextPage;
      try {
        localStorage.setItem(`${PAGE_KEY}:${topic}`, String(page));
      } catch {
        // resume point not saved
      }
      if (emptyPages >= 15) {
        log({ tone: "info", text: "لم نجد كتباً جديدة في آخر 15 صفحة؛ توقّف الاستيراد." });
        break;
      }
    }
    setRunning(false);
    router.refresh();
  }

  async function importOne(e: React.FormEvent) {
    e.preventDefault();
    const id = Number(bookId);
    if (!Number.isSafeInteger(id) || id < 1) return log({ tone: "error", text: "اكتب رقم كتاب صحيح من رابط Gutenberg." });
    setRunning(true);
    log(describe(await importGutenbergByIdAction(id)));
    setRunning(false);
    router.refresh();
  }

  async function importPicks() {
    stop.current = false;
    setRunning(true);
    for (const pick of pending) {
      if (stop.current) break;
      log({ tone: "info", text: `جارٍ تحميل «${pick.title}»…` });
      const result = await importGutenbergByIdAction(pick.id);
      log(describe(result));
      if (result.ok) setPending((list) => list.filter((p) => p.id !== pick.id));
    }
    setRunning(false);
    router.refresh();
  }

  return (
    <section className="card p-5" aria-labelledby="gutenberg-heading">
      <h2 id="gutenberg-heading" className="text-lg font-bold">كتب إنكليزية من Project Gutenberg</h2>
      <p className="mt-1 text-sm leading-7 text-muted">
        نتجاوز تلقائياً أي كتاب قد يكون محمياً خارج أمريكا (مؤلف أو مترجم توفي بعد {new Date().getFullYear() - 71}).
      </p>

      <div className="mt-4 rounded-xl bg-surface-2 p-4">
        <p className="text-sm font-semibold">كلاسيكيات مختارة: خيال وفانتازيا ومغامرات</p>
        <p className="mt-1 text-xs text-muted">
          {pending.length
            ? `${pending.length} من ${picks.length} لم تُستورد بعد، مثل ساحر أوز وآلة الزمن وحكايات غريم.`
            : "كل الكتب المختارة مستوردة."}
        </p>
        {pending.length > 0 && (
          <details className="mt-2 text-xs text-muted">
            <summary className="cursor-pointer">عرض القائمة</summary>
            <p className="mt-2 leading-6" dir="ltr">
              {pending.map((p) => p.title).join(" · ")}
            </p>
          </details>
        )}
        <button type="button" className="btn-primary mt-3" onClick={importPicks} disabled={running || pending.length === 0}>
          {running && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
          استيراد المختارة
        </button>
      </div>

      <p className="mt-5 text-sm font-semibold">أو الأكثر قراءة حسب النوع</p>
      <p className="mt-1 text-xs text-muted">البحث حسب النوع يعتمد على خدمة Gutendex، وقد يفشل حين تكون مزدحمة؛ جرّب لاحقاً.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="gtopic" className="label">النوع</label>
          <select id="gtopic" value={topic} onChange={(e) => setTopic(e.target.value as GutenbergTopic)} className="input w-auto" disabled={running}>
            {GUTENBERG_TOPICS.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="gcount" className="label">عدد الكتب</label>
          <input id="gcount" type="number" min={1} max={500} value={count} onChange={(e) => setCount(Math.min(500, Math.max(1, Number(e.target.value) || 1)))} className="input w-28" />
        </div>
        {running ? (
          <button type="button" className="btn-secondary" onClick={() => (stop.current = true)}>
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            إيقاف ({done}/{count})
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={runBatch}>
            ابدأ الاستيراد
          </button>
        )}
      </div>
      <form onSubmit={importOne} className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-5">
        <div>
          <label htmlFor="gid" className="label">أو كتاب محدد برقمه</label>
          <input id="gid" inputMode="numeric" dir="ltr" placeholder="1342" value={bookId} onChange={(e) => setBookId(e.target.value.replace(/\D/g, ""))} className="input w-36" />
        </div>
        <button type="submit" className="btn-secondary" disabled={running}>
          استيراد
        </button>
        <p className="w-full text-xs text-muted">الرقم موجود في رابط الكتاب، مثلاً gutenberg.org/ebooks/1342</p>
      </form>
      <Log lines={lines} />
    </section>
  );
}

function WikisourceImport({ starter }: { starter: StarterItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(starter);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(starter.filter((s) => !s.imported).map((s) => s.page)));
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [custom, setCustom] = useState<{ page: string; category: CategoryId; title: string; author: string }>({
    page: "",
    category: "literature",
    title: "",
    author: "",
  });
  const log = (line: LogLine) => setLines((l) => [...l, line].slice(-200));

  async function importSelected() {
    setRunning(true);
    for (const item of items) {
      if (!selected.has(item.page) || item.imported) continue;
      log({ tone: "info", text: `جارٍ تصدير «${item.title}»…` });
      const result = await importStarterAction(item.page);
      log(describe(result));
      if (result.ok && result.status !== "skipped") {
        setItems((all) => all.map((s) => (s.page === item.page ? { ...s, imported: true } : s)));
        setSelected((s) => {
          const next = new Set(s);
          next.delete(item.page);
          return next;
        });
      }
    }
    setRunning(false);
    router.refresh();
  }

  async function importCustom(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    log({ tone: "info", text: `جارٍ تصدير «${custom.page}»…` });
    log(describe(await importWikisourceAction(custom)));
    setRunning(false);
    router.refresh();
  }

  const pending = items.filter((s) => selected.has(s.page) && !s.imported).length;

  return (
    <section className="card p-5" aria-labelledby="wikisource-heading">
      <h2 id="wikisource-heading" className="text-lg font-bold">كتب عربية من ويكي مصدر</h2>
      <p className="mt-1 text-sm leading-7 text-muted">
        كلاسيكيات عربية في الملكية العامة، نصّها الرقمي برخصة CC BY-SA. كل كتاب يأخذ بضع ثوانٍ.
      </p>
      <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.page}>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
              {item.imported ? (
                <CircleCheck className="h-4 w-4 shrink-0 text-green-600" aria-label="مستورد" />
              ) : (
                <input
                  type="checkbox"
                  checked={selected.has(item.page)}
                  onChange={(e) =>
                    setSelected((s) => {
                      const next = new Set(s);
                      if (e.target.checked) next.add(item.page);
                      else next.delete(item.page);
                      return next;
                    })
                  }
                  className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
              )}
              <span className={item.imported ? "text-muted" : ""}>
                {item.title} <span className="text-xs text-muted">· {item.author}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <button type="button" className="btn-primary mt-4" onClick={importSelected} disabled={running || pending === 0}>
        {running && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {pending ? `استيراد ${pending} كتاب` : "كل الكتب المقترحة مستوردة"}
      </button>

      <form onSubmit={importCustom} className="mt-6 grid gap-3 border-t border-line pt-5 sm:grid-cols-2">
        <p className="text-sm font-semibold sm:col-span-2">أو أي كتاب آخر من ويكي مصدر</p>
        <div className="sm:col-span-2">
          <label htmlFor="wpage" className="label">اسم الصفحة كما في ويكي مصدر</label>
          <input id="wpage" required value={custom.page} onChange={(e) => setCustom((c) => ({ ...c, page: e.target.value }))} placeholder="مثلاً: البخلاء" className="input" />
        </div>
        <div>
          <label htmlFor="wtitle" className="label">العنوان المعروض (اختياري)</label>
          <input id="wtitle" value={custom.title} onChange={(e) => setCustom((c) => ({ ...c, title: e.target.value }))} className="input" />
        </div>
        <div>
          <label htmlFor="wauthor" className="label">المؤلف (اختياري)</label>
          <input id="wauthor" value={custom.author} onChange={(e) => setCustom((c) => ({ ...c, author: e.target.value }))} className="input" />
        </div>
        <div>
          <label htmlFor="wcat" className="label">التصنيف</label>
          <select id="wcat" value={custom.category} onChange={(e) => setCustom((c) => ({ ...c, category: e.target.value as CategoryId }))} className="input">
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.ar}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-secondary w-full" disabled={running}>
            استيراد الصفحة
          </button>
        </div>
      </form>
      <Log lines={lines} />
    </section>
  );
}

export interface HindawiItem {
  id: string;
  title: string;
  category: CategoryId;
  film: boolean;
  imported: boolean;
}

function HindawiImport({ picks }: { picks: HindawiItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(picks);
  const [running, setRunning] = useState(false);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [custom, setCustom] = useState<{ address: string; category: CategoryId; film: string }>({ address: "", category: "novels", film: "" });
  const stop = useRef(false);
  const log = (line: LogLine) => setLines((l) => [...l, line].slice(-200));
  const pending = items.filter((i) => !i.imported);

  async function importPicks() {
    stop.current = false;
    setRunning(true);
    for (const item of pending) {
      if (stop.current) break;
      log({ tone: "info", text: `جارٍ تحميل «${item.title}»…` });
      const result = await importHindawiPickAction(item.id);
      log(describe(result));
      if (result.ok && result.status !== "skipped") {
        setItems((all) => all.map((i) => (i.id === item.id ? { ...i, imported: true } : i)));
      }
    }
    setRunning(false);
    router.refresh();
  }

  async function importCustom(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    log({ tone: "info", text: "جارٍ فحص رخصة الكتاب وتحميله…" });
    log(describe(await importHindawiAction(custom)));
    setRunning(false);
    router.refresh();
  }

  const byCategory = CATEGORIES.map((c) => ({ ...c, count: pending.filter((i) => i.category === c.id).length })).filter((c) => c.count);

  return (
    <section className="card p-5 lg:col-span-2" aria-labelledby="hindawi-heading">
      <h2 id="hindawi-heading" className="text-lg font-bold">كتب عربية كاملة من مؤسسة هنداوي</h2>
      <p className="mt-1 text-sm leading-7 text-muted">
        نسخ كاملة بأغلفتها. قبل كل كتاب نقرأ صفحة الحقوق داخله، ونستورده فقط إذا كان كله (النص والترجمة والغلاف) برخصة CC BY 4.0
        وصدر أصله قبل {new Date().getUTCFullYear() - 95}؛ الكتب المحفوظة الحقوق أو غير التجارية تُترك تلقائياً.
      </p>

      <div className="mt-4 rounded-xl bg-surface-2 p-4">
        <p className="text-sm font-semibold">مختارات: روايات وقصص تاريخية وخيال وبوليسية ({picks.length} كتاب)</p>
        <p className="mt-1 text-xs leading-6 text-muted">
          {pending.length
            ? `${pending.length} لم تُستورد بعد: ${byCategory.map((c) => `${categoryLabel(c.id)} ${c.count}`).join("، ")}.`
            : "كل الكتب المختارة مستوردة."}
        </p>
        {running ? (
          <button type="button" className="btn-secondary mt-3" onClick={() => (stop.current = true)}>
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            إيقاف
          </button>
        ) : (
          <button type="button" className="btn-primary mt-3" onClick={importPicks} disabled={pending.length === 0}>
            {pending.length ? `استيراد ${pending.length} كتاب` : "لا جديد"}
          </button>
        )}
        <p className="mt-2 text-xs text-muted">الكتاب الواحد بين ٢ و٥ ميغابايت؛ يمكنك الإيقاف والمتابعة لاحقاً.</p>
      </div>

      <form onSubmit={importCustom} className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="haddress" className="label">أو كتاب محدد: رابطه في موقع هنداوي</label>
          <input id="haddress" required dir="ltr" value={custom.address} onChange={(e) => setCustom((c) => ({ ...c, address: e.target.value }))} placeholder="https://www.safahat.org/books/53742042/" className="input" />
        </div>
        <div>
          <label htmlFor="hcat" className="label">التصنيف</label>
          <select id="hcat" value={custom.category} onChange={(e) => setCustom((c) => ({ ...c, category: e.target.value as CategoryId }))} className="input">
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.ar}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="hfilm" className="label">صار فيلماً؟ (اختياري)</label>
          <input id="hfilm" value={custom.film} onChange={(e) => setCustom((c) => ({ ...c, film: e.target.value }))} placeholder="اسم الفيلم (السنة)" className="input" />
        </div>
        <button type="submit" className="btn-secondary" disabled={running}>
          استيراد
        </button>
      </form>
      <Log lines={lines} />
    </section>
  );
}

export function ImportPanel({ starter, picks, hindawi }: { starter: StarterItem[]; picks: PickItem[]; hindawi: HindawiItem[] }) {
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <HindawiImport picks={hindawi} />
      <WikisourceImport starter={starter} />
      <GutenbergImport picks={picks} />
    </div>
  );
}
