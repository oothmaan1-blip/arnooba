// Gutendex "topic" filters (matched against Gutenberg subjects and shelves).
// Shared by the admin import panel and the server.
export const GUTENBERG_TOPICS = [
  { id: "", label: "الأكثر قراءة من كل الأنواع" },
  { id: "fantasy", label: "فانتازيا" },
  { id: "science fiction", label: "خيال علمي" },
  { id: "fairy tales", label: "حكايات خرافية" },
  { id: "adventure", label: "مغامرات" },
  { id: "detective", label: "بوليسية" },
  { id: "horror", label: "رعب" },
  { id: "children", label: "أطفال" },
  { id: "history", label: "تاريخ" },
  { id: "philosophy", label: "فلسفة" },
  { id: "poetry", label: "شعر" },
] as const;

export type GutenbergTopic = (typeof GUTENBERG_TOPICS)[number]["id"];

export function isGutenbergTopic(value: unknown): value is GutenbergTopic {
  return GUTENBERG_TOPICS.some((t) => t.id === value);
}
