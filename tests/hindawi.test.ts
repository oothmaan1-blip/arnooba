import assert from "node:assert/strict";
import { test } from "node:test";
import {
  asciiDigits,
  describeHindawiBook,
  isOldEnough,
  mapHindawiCategory,
  readCopyrightPage,
  readTitlePage,
  republishable,
} from "../src/lib/import/hindawi-rules.ts";

const page = (rights: string, published = "صدر الكتاب الأصلي باللغة الإنجليزية عام ١٩١٢.") => `
<body><div class="copyright">
<div class="header"><div><h2>الطاعون القرمزي</h2><h2 dir="ltr">The Scarlet Plague</h2></div><div><h3>جاك لندن</h3><h3 dir="ltr">Jack London</h3></div></div>
<div class="copyright-content"><p>تصميم الغلاف: عبد العظيم بيدس<br /><br />الترقيم الدولى: ‭٩٧٨ ١ ٥٢٧٣ ٢٠٨٠ ٢‬<br />${published}<br />صدرت هذه الترجمة عن مؤسسة هنداوي عام ٢٠٢٠.<br /><br />${rights}</p></div></div></body>`;

const CC_BY =
  "جميع حقوق النشر الخاصة بتصميم هذا الكتاب، وتصميم الغلاف، والترجمة العربية لنص هذا الكتاب مُرَخَّصة بموجب رخصة المشاع الإبداعي: نَسْبُ المُصنَّف، الإصدار ٤٫٠. جميع حقوق النشر الخاصة بنص العمل الأصلي خاضعة للملكية العامة.";
const NC =
  "جميع حقوق النشر الخاصة بتصميم هذا الكتاب وتصميم الغلاف، والترجمة العربية لنص هذا الكتاب مُرَخَّصة بموجب رخصة المشاع الإبداعي: نسب المصنف-غير تجاري، الإصدار ٤٫٠. جميع حقوق النشر الخاصة بنص العمل الأصلي خاضعة للملكية العامة.";
const RESERVED =
  "جميع حقوق النشر الخاصة بتصميم هذا الكتاب وتصميم الغلاف محفوظة لمؤسسة هنداوي. جميع حقوق النشر الخاصة بنص العمل الأصلي محفوظة للسيدة الدكتورة أماني فوزي حبشي.";
const DESIGN_RESERVED =
  "جميع حقوق النشر الخاصة بتصميم هذا الكتاب وتصميم الغلاف محفوظة لمؤسسة هنداوي. جميع حقوق النشر الخاصة بنص العمل الأصلي خاضعة للملكية العامة.";

const NOW = new Date(Date.UTC(2026, 9, 1));

test("reads titles, authors and the original year from the copyright page", () => {
  const c = readCopyrightPage(page(CC_BY));
  assert.equal(c.title, "الطاعون القرمزي");
  assert.equal(c.originalTitle, "The Scarlet Plague");
  assert.equal(c.author, "جاك لندن");
  assert.equal(c.originalAuthor, "Jack London");
  assert.equal(c.originalYear, 1912);
  assert.equal(c.originalLanguage, "الإنجليزية");
  assert.equal(c.rights, "cc-by");
});

test("only CC BY editions of old public-domain works may be republished", () => {
  assert.equal(republishable(readCopyrightPage(page(CC_BY)), NOW), null);
  assert.equal(readCopyrightPage(page(NC)).rights, "non-commercial");
  assert.ok(republishable(readCopyrightPage(page(NC)), NOW));
  assert.equal(readCopyrightPage(page(RESERVED)).rights, "reserved");
  assert.ok(republishable(readCopyrightPage(page(RESERVED)), NOW));
  // Text free but Hindawi's design and cover reserved: not ours to copy as a file.
  assert.ok(republishable(readCopyrightPage(page(DESIGN_RESERVED)), NOW));
  // CC BY translation of a 1959 novel: the original may still be protected.
  assert.match(republishable(readCopyrightPage(page(CC_BY, "صدر أصل هذا الكتاب باللغة الإيطالية عام ١٩٥٩.")), NOW) ?? "", /1959/);
  // No year printed: refuse.
  assert.ok(republishable(readCopyrightPage(page(CC_BY, "")), NOW));
});

test("an older third-party translation must be old enough too", () => {
  const recent = readCopyrightPage(page(CC_BY, "صدر أصل هذا الكتاب باللغة الروسية عام ١٨٦٩.<br />صدرت هذه الترجمة عام ١٩٥٣."));
  assert.equal(recent.originalYear, 1869);
  assert.equal(recent.translationYear, 1953);
  assert.match(republishable(recent, NOW) ?? "", /1953/);

  const old = readCopyrightPage(page(CC_BY, "صدر أصل هذا الكتاب باللغة الفرنسية في تاريخ غير معروف.<br />صدرت هذه الترجمة عام ١٩٢٥."));
  assert.equal(old.originalYear, null);
  assert.equal(old.translationYear, 1925);
  assert.equal(republishable(old, NOW), null);

  // Hindawi's own translation ("…عن مؤسسة هنداوي عام 2020") is CC BY, whatever its date.
  assert.equal(readCopyrightPage(page(CC_BY)).translationYear, null);
});

test("Arabic originals carry their own publication year", () => {
  const c = readCopyrightPage(page(CC_BY.replace("، والترجمة العربية لنص هذا الكتاب", ""), "صدر هذا الكتاب عام ١٨٩٧."));
  assert.equal(c.originalYear, 1897);
  assert.equal(c.originalLanguage, "");
  assert.equal(republishable(c, NOW), null);
});

test("the cut-off year moves with the calendar (US: 95 years after publication)", () => {
  assert.ok(isOldEnough(1930, NOW));
  assert.ok(!isOldEnough(1931, NOW));
  assert.ok(isOldEnough(1931, new Date(Date.UTC(2027, 0, 1))));
  assert.ok(!isOldEnough(null, NOW));
});

test("title page names the author and translator", () => {
  const fp2 = `<div class="center fp"><h1 class="title">الطاعون القرمزي</h1>
<p class="author">\nتأليف<br/>\nجاك لندن\n</p>\n<p>\nترجمة<br/>\nالزهراء سامي\n</p>\n<p>\nمراجعة<br/>\nهاني فتحي سليمان\n</p></div>`;
  assert.deepEqual(readTitlePage(fp2), { author: "جاك لندن", translator: "الزهراء سامي" });
  assert.deepEqual(readTitlePage("<p>شيء آخر</p>"), { author: "", translator: "" });
});

test("categories and generated descriptions", () => {
  assert.equal(mapHindawiCategory(["novels", "science.fiction"]), "fantasy");
  assert.equal(mapHindawiCategory(["detective.fiction"]), "mystery");
  assert.equal(mapHindawiCategory(["biographies"]), "history");
  assert.equal(mapHindawiCategory([]), "other");
  const description = describeHindawiBook(readCopyrightPage(page(CC_BY)), { author: "جاك لندن", translator: "الزهراء سامي" });
  assert.match(description, /الطاعون القرمزي/);
  assert.match(description, /1912/);
  assert.match(description, /الزهراء سامي/);
  assert.equal(asciiDigits("١٩٢٤ ۱۹"), "1924 19");
});

test("an original dated only by its century counts as old", () => {
  const c = readCopyrightPage(page(CC_BY, "صدر هذا الكتاب في القرن الحادي عشر الميلادي."));
  assert.equal(c.originalYear, null);
  assert.equal(c.originalCentury, "القرن الحادي عشر الميلادي");
  assert.equal(republishable(c, NOW), null);
  assert.match(describeHindawiBook(c, { author: "", translator: "" }), /القرن الحادي عشر/);
  assert.ok(republishable(readCopyrightPage(page(CC_BY, "صدر هذا الكتاب في القرن العشرين.")), NOW));
  assert.ok(republishable(readCopyrightPage(page(CC_BY, "صدر هذا الكتاب في تاريخ غير معروف.")), NOW));
});
