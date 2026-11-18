import { readLocal, writeLocal } from "./local";

export const REACTION_OPTIONS = [
  { id: "like", label: "أعجبني", emoji: "💛" },
  { id: "exciting", label: "حماسي", emoji: "⚡" },
  { id: "moving", label: "مؤثر", emoji: "🥹" },
  { id: "shock", label: "صدمة", emoji: "😲" },
] as const;

export type ReactionId = (typeof REACTION_OPTIONS)[number]["id"];
export type ReactionCounts = Record<string, Partial<Record<ReactionId, number>>>;

const VISITOR_KEY = "arnooba:reaction-visitor:v1";
const PICKS_KEY = "arnooba:reaction-picks:v1";

export function reactionVisitorId(): string {
  try {
    const saved = localStorage.getItem(VISITOR_KEY);
    if (saved && /^[0-9a-f-]{36}$/i.test(saved)) return saved;
    const random = newVisitorId();
    localStorage.setItem(VISITOR_KEY, random);
    return random;
  } catch {
    return newVisitorId();
  }
}

function newVisitorId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function pickKey(bookId: number, chapter: string): string {
  return `${bookId}:${chapter}`;
}

export function selectedReaction(bookId: number, chapter: string): ReactionId | null {
  const picks = readLocal<Record<string, ReactionId>>(PICKS_KEY, {});
  const value = picks[pickKey(bookId, chapter)];
  return REACTION_OPTIONS.some((item) => item.id === value) ? value : null;
}

export function rememberReaction(bookId: number, chapter: string, reaction: ReactionId): void {
  const picks = readLocal<Record<string, ReactionId>>(PICKS_KEY, {});
  writeLocal(PICKS_KEY, { ...picks, [pickKey(bookId, chapter)]: reaction });
}
