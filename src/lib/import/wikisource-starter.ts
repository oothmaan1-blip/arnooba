import type { WikisourceEntry } from "./wikisource";

// Works checked to export as complete books from Arabic Wikisource (pages that
// are only an index of sub-pages were left out; partial transcriptions were
// retired, see the end of this file). Authors and translators are
// long dead, or the translation is published on Wikisource under CC BY / BY-SA.
export const WIKISOURCE_STARTER: (WikisourceEntry & { title: string; author: string; description: string })[] = [
  {
    page: "كليلة ودمنة",
    complete: true,
    title: "كليلة ودمنة",
    author: "ابن المقفع",
    category: "literature",
    description:
      "حكايات على ألسنة الحيوان نقلها ابن المقفع إلى العربية، تحمل الحكمة والنصيحة في السياسة والأخلاق والصداقة، وما زالت تُقرأ للكبار والصغار.",
  },
  {
    page: "البخلاء",
    complete: true,
    title: "البخلاء",
    author: "الجاحظ",
    category: "literature",
    description:
      "من أشهر كتب الجاحظ، يجمع فيه نوادر البخلاء وحكاياتهم وحججهم في الإمساك، بأسلوب ساخر يرسم صورة حيّة لمجتمع العصر العباسي.",
  },
  {
    page: "مقامات الحريري",
    complete: true,
    title: "مقامات الحريري",
    author: "الحريري",
    category: "literature",
    description:
      "خمسون مقامة يروي فيها الحارث بن همّام مغامرات أبي زيد السروجي المحتال الفصيح، وهي من روائع النثر العربي في البلاغة واللعب باللغة.",
  },
  {
    page: "طبائع الاستبداد",
    complete: true,
    title: "طبائع الاستبداد ومصارع الاستعباد",
    author: "عبد الرحمن الكواكبي",
    category: "philosophy",
    description:
      "تحليل الكواكبي للاستبداد السياسي وأثره في الدين والعلم والأخلاق والمال، وطرق الخلاص منه.",
  },
  {
    page: "المنقذ من الضلال",
    complete: true,
    title: "المنقذ من الضلال",
    author: "أبو حامد الغزالي",
    category: "philosophy",
    description:
      "سيرة فكرية يروي فيها الغزالي رحلته في طلب اليقين بين علم الكلام والفلسفة والباطنية والتصوف.",
  },
  {
    page: "فصل المقال فيما بين الحكمة والشريعة من الاتصال",
    complete: true,
    title: "فصل المقال فيما بين الحكمة والشريعة من الاتصال",
    author: "ابن رشد",
    category: "philosophy",
    description: "رسالة ابن رشد في العلاقة بين الفلسفة والدين، يدافع فيها عن النظر العقلي ويبيّن أنهما لا يتعارضان.",
  },
  {
    page: "الأخلاق والسير في مداواة النفوس",
    complete: true,
    title: "الأخلاق والسير في مداواة النفوس",
    author: "ابن حزم الأندلسي",
    category: "philosophy",
    description: "تأملات ابن حزم في أخلاق الناس وعيوب النفس وعلاجها، مستخلصة من تجربته الشخصية.",
  },
  {
    page: "البيان والتبيين",
    complete: true,
    title: "البيان والتبيين",
    author: "الجاحظ",
    category: "literature",
    description:
      "موسوعة الجاحظ في البلاغة والخطابة والبيان، مليئة بالخطب والأخبار والنوادر، ومن أمهات كتب الأدب العربي.",
  },
  {
    page: "الأدب الكبير",
    complete: true,
    title: "الأدب الكبير",
    author: "ابن المقفع",
    category: "literature",
    description: "وصايا ابن المقفع في السلطان وصحبة الملوك والأصدقاء وأدب النفس، بأسلوب بليغ موجز.",
  },
  {
    page: "الأدب الصغير",
    complete: true,
    title: "الأدب الصغير",
    author: "ابن المقفع",
    category: "literature",
    description: "حِكم ووصايا قصيرة لابن المقفع في تهذيب النفس وحسن معاملة الناس.",
  },
  {
    page: "رسالة التوابع والزوابع",
    title: "رسالة التوابع والزوابع",
    author: "ابن شهيد الأندلسي",
    category: "fantasy",
    description: "رحلة خيالية يلتقي فيها ابن شهيد بتوابع الشعراء والكتّاب من الجن ويناظرهم في الشعر والنثر.",
  },
  {
    page: "لامية العرب",
    complete: true,
    title: "لامية العرب",
    author: "الشنفرى",
    category: "literature",
    description: "قصيدة الشاعر الصعلوك الشنفرى، من أشهر قصائد الشعر الجاهلي في الفخر ووصف حياة الصحراء.",
  },
  {
    page: "الأربعون النووية",
    complete: true,
    title: "الأربعون النووية",
    author: "الإمام النووي",
    category: "religion",
    description: "اثنان وأربعون حديثاً نبوياً جمعها الإمام النووي، من أكثر المتون انتشاراً وحفظاً.",
  },

  // — Fantasy, fairy tales and epics —
  {
    page: "أخ وأخته",
    complete: true,
    title: "الأخ الصغير والأخت الصغيرة",
    author: "الأخوان غريم",
    category: "fantasy",
    description: "أخ وأخته يهربان إلى الغابة من زوجة أب ساحرة، فيشرب الأخ من نبع مسحور ويتحول إلى غزال. حكاية من الأخوين غريم.",
  },
  {
    page: "طفلة مريم",
    complete: true,
    title: "طفلة مريم",
    author: "الأخوان غريم",
    category: "fantasy",
    description: "حكاية من الأخوين غريم عن فتاة صغيرة تُعطى مفاتيح ثلاثة عشر باباً وتُمنع من فتح واحد منها فقط.",
  },
  {
    page: "الملكة الضفدعة",
    complete: true,
    title: "الملكة الضفدعة",
    author: "حكاية شعبية روسية",
    category: "fantasy",
    description: "أمير يتزوج ضفدعة يتبيّن أنها أميرة مسحورة، في حكاية شعبية روسية مليئة بالسحر والمغامرة.",
  },
  {
    page: "باسم السمكة السحرية",
    complete: true,
    title: "باسم السمكة السحرية",
    author: "حكاية شعبية روسية",
    category: "fantasy",
    description: "شاب كسول يصطاد سمكة سحرية تحقق له كل ما يطلب، فتنقلب حياته رأساً على عقب. حكاية شعبية روسية.",
  },
  {
    page: "سهراب",
    complete: true,
    title: "رستم وسهراب",
    author: "الفردوسي (الشاهنامة)",
    category: "fantasy",
    description: "من ملحمة الشاهنامة: المأساة الشهيرة للبطل رستم الذي يواجه في المعركة فارساً شاباً لا يعرف أنه ابنه سهراب.",
  },
  {
    page: "هفتخوان رستم",
    complete: true,
    title: "هفتخوان رستم: المراحل السبع",
    author: "الفردوسي (الشاهنامة)",
    category: "fantasy",
    description: "من الشاهنامة: المراحل السبع التي يقطعها البطل رستم، يصارع فيها الأسد والتنين والساحرة والجن ليحرر ملكه.",
  },
  {
    page: "هفتخوان اسفنديار",
    complete: true,
    title: "هفتخوان اسفنديار",
    author: "الفردوسي (الشاهنامة)",
    category: "fantasy",
    description: "من الشاهنامة: المراحل السبع للبطل اسفنديار في طريقه إلى قلعة أعدائه، بين الذئاب والتنين والطائر العملاق.",
  },
  {
    page: "ضحاك",
    complete: true,
    title: "الضحاك",
    author: "الفردوسي (الشاهنامة)",
    category: "fantasy",
    description: "من الشاهنامة: حكاية الملك الطاغية الضحاك الذي نبتت على كتفيه حيّتان لا تشبعان، وثورة الحداد كاوه عليه.",
  },
  {
    page: "سياوش",
    complete: true,
    title: "سياوش",
    author: "الفردوسي (الشاهنامة)",
    category: "fantasy",
    description: "من الشاهنامة: قصة الأمير سياوش الذي يعبر النار ليثبت براءته، ثم يلقى مصيراً مأساوياً في بلاد توران.",
  },
  {
    page: "بيجن",
    complete: true,
    title: "بيجن ومنيجة",
    author: "الفردوسي (الشاهنامة)",
    category: "fantasy",
    description: "من الشاهنامة: قصة الفارس بيجن وحبه لمنيجة ابنة ملك توران، وسجنه في البئر حتى ينقذه رستم.",
  },

  // — Novels and stories —
  {
    page: "الزير سالم",
    title: "الزير سالم",
    author: "سيرة شعبية",
    category: "novels",
    description: "السيرة الشعبية للمهلهل بن ربيعة (الزير سالم) وثأره لأخيه كليب في حرب البسوس، من أشهر السير الشعبية العربية.",
  },
  {
    page: "الطفولتان",
    complete: true,
    title: "الطفولتان",
    author: "مصطفى صادق الرافعي",
    category: "novels",
    description: "قصة قصيرة لمصطفى صادق الرافعي بأسلوبه البياني المعروف.",
  },
  {
    page: "اليمامتان",
    complete: true,
    title: "اليمامتان",
    author: "مصطفى صادق الرافعي",
    category: "novels",
    description: "قصة قصيرة لمصطفى صادق الرافعي بأسلوبه البياني المعروف.",
  },
  {
    page: "ندم",
    complete: true,
    title: "ندم",
    author: "كيت شوبان",
    category: "novels",
    description: "قصة قصيرة للكاتبة الأمريكية كيت شوبان، مترجمة إلى العربية.",
  },

];

/**
 * Pages that used to be in the list. Their Wikisource transcriptions turned out
 * to be incomplete (missing chapters or pages), or a complete edition with a
 * cover now comes from the Hindawi Foundation instead. `npm run seed -- --prune`
 * removes them from a library that imported them earlier.
 */
export const RETIRED_WIKISOURCE_PAGES: readonly string[] = [
  // Incomplete transcriptions:
  "رحلة ابن جبير",
  "تهافت الفلاسفة",
  "عجائب المخلوقات وغرائب الموجودات",
  "مغامرات توم سوير",
  "مغامرات حاجي بابا الإصفهاني",
  "أميرة إنكلترة",
  "التيجان في ملوك حمير",
  // Replaced by complete Hindawi editions (the three tales are in «رابونزل وقصص أخرى»):
  "بياض الثلج والأقزام السبعة",
  "سندريلا",
  "رابونزيل",
  "ألف ليلة وليلة",
  "طوق الحمامة",
  "رسالة الغفران",
  "حي بن يقظان",
  "الأجنحة المتكسرة",
  "تحفة النظار في غرائب الأمصار وعجائب الأسفار",
  "تخليص الإبريز في تلخيص باريز",
  "النظرات",
  "الأطفال الخمسة وعفريت الرمال",
  "تاجر البندقية",
  "رحلة جرجي زيدان إلى أوربا",
];
