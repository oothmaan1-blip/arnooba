// Book cover images, made on the server with sharp.
//  - normalizeCover: shrinks a publisher's cover to a light JPEG for the grids.
//  - generateCover: draws a cover (pattern, frame, title, author) for books that
//    have none. Text is shaped by Pango with the bundled Noto Arabic fonts
//    (SIL Open Font License), so Arabic renders correctly on any server.
import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import type { CategoryId } from "./categories";

const WIDTH = 600;
const HEIGHT = 900;
const FONT_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "assets", "fonts");
const FONTS = {
  title: { family: "Noto Naskh Arabic Bold", file: "NotoNaskhArabic-Bold.ttf" },
  body: { family: "Noto Naskh Arabic", file: "NotoNaskhArabic.ttf" },
  label: { family: "Noto Kufi Arabic Bold", file: "NotoKufiArabic-Bold.ttf" },
} as const;

/** Resizes any JPEG/PNG/WebP cover to at most 600px wide, as JPEG. */
export async function normalizeCover(image: Uint8Array): Promise<Uint8Array> {
  const out = await sharp(image, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize({ width: WIDTH, height: HEIGHT * 2, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  return new Uint8Array(out);
}

interface Palette {
  from: string;
  to: string;
  accent: string;
  ink: string;
}

// Two palettes per category; the title picks one, so neighbours differ.
const PALETTES: Record<CategoryId, [Palette, Palette]> = {
  novels: [
    { from: "#5b1a2a", to: "#2c0c15", accent: "#e8c27a", ink: "#fbeee0" },
    { from: "#17414a", to: "#0b2328", accent: "#e6c48a", ink: "#f2efe6" },
  ],
  fantasy: [
    { from: "#2e1f5e", to: "#120a2c", accent: "#d9b8ff", ink: "#f4ecff" },
    { from: "#0f3b57", to: "#06192a", accent: "#8fe3d6", ink: "#eafaf7" },
  ],
  mystery: [
    { from: "#1d2430", to: "#0a0d12", accent: "#d64545", ink: "#f1f1f1" },
    { from: "#2b2b2b", to: "#101010", accent: "#e0b04a", ink: "#f5f0e6" },
  ],
  literature: [
    { from: "#1f4a33", to: "#0d2419", accent: "#e3c47b", ink: "#f4efe2" },
    { from: "#4a3a1f", to: "#241a0b", accent: "#f0d08a", ink: "#fbf3e2" },
  ],
  history: [
    { from: "#5a3b1c", to: "#2a1a0a", accent: "#e9c37d", ink: "#fbf1de" },
    { from: "#3d2b4f", to: "#1a1124", accent: "#e8c77f", ink: "#f6efe2" },
  ],
  philosophy: [
    { from: "#2f3a4a", to: "#141a23", accent: "#c9d6e8", ink: "#eef2f7" },
    { from: "#3a3a3a", to: "#161616", accent: "#d8c9a3", ink: "#f2eee4" },
  ],
  religion: [
    { from: "#0f4b3e", to: "#06241d", accent: "#e6cf8f", ink: "#f3efe3" },
    { from: "#1b3d5c", to: "#0b1b2b", accent: "#e6cf8f", ink: "#f0f2f5" },
  ],
  science: [
    { from: "#123f6b", to: "#071d33", accent: "#7fd1ff", ink: "#eef7ff" },
    { from: "#244b2a", to: "#0f2312", accent: "#b8e986", ink: "#f1f8ea" },
  ],
  children: [
    { from: "#f08a24", to: "#c4561a", accent: "#fff3b0", ink: "#ffffff" },
    { from: "#2b8fd6", to: "#1a5fa0", accent: "#ffe27a", ink: "#ffffff" },
  ],
  other: [
    { from: "#3b4a5a", to: "#1a222b", accent: "#e1c58b", ink: "#f3f0ea" },
    { from: "#4b2f3f", to: "#22131c", accent: "#e8c9a0", ink: "#f7eff2" },
  ],
};

const LABELS: Record<CategoryId, string> = {
  novels: "رواية",
  fantasy: "خيال وفانتازيا",
  mystery: "بوليسية",
  literature: "أدب",
  history: "تاريخ وسِيَر",
  philosophy: "فكر",
  religion: "دين",
  science: "علوم",
  children: "قصص للأطفال",
  other: "كتاب",
};

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const escapeMarkup = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function textImage(text: string, font: keyof typeof FONTS, size: number, color: string, width: number) {
  const { data, info } = await sharp({
    text: {
      text: `<span foreground="${color}">${escapeMarkup(text)}</span>`,
      font: `${FONTS[font].family} ${size}`,
      fontfile: path.join(/*turbopackIgnore: true*/ FONT_DIR, FONTS[font].file),
      width,
      align: "centre",
      wrap: "word",
      rgba: true,
      dpi: 72,
      spacing: Math.round(size * 0.2),
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function titleSize(title: string): number {
  const n = [...title].length;
  return n <= 10 ? 78 : n <= 18 ? 68 : n <= 30 ? 58 : n <= 50 ? 48 : 40;
}

function background(p: Palette, variant: number): string {
  // An eight-pointed star lattice (two overlapping squares) under a soft vignette.
  const tile = variant % 2 ? 90 : 74;
  const half = tile / 2;
  const r = tile * 0.3;
  const square = (rot: number) =>
    `<rect x="${half - r}" y="${half - r}" width="${2 * r}" height="${2 * r}" transform="rotate(${rot} ${half} ${half})"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="${p.from}"/><stop offset="1" stop-color="${p.to}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.45" r="0.6">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.10"/><stop offset="1" stop-color="#000000" stop-opacity="0.25"/>
    </radialGradient>
    <pattern id="stars" width="${tile}" height="${tile}" patternUnits="userSpaceOnUse">
      <g fill="none" stroke="${p.accent}" stroke-width="1.2" stroke-opacity="0.16">${square(0)}${square(45)}
        <circle cx="0" cy="0" r="${tile * 0.08}"/><circle cx="${tile}" cy="0" r="${tile * 0.08}"/>
        <circle cx="0" cy="${tile}" r="${tile * 0.08}"/><circle cx="${tile}" cy="${tile}" r="${tile * 0.08}"/>
      </g>
    </pattern>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#stars)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
  <rect x="26" y="26" width="${WIDTH - 52}" height="${HEIGHT - 52}" fill="none" stroke="${p.accent}" stroke-width="2.5" stroke-opacity="0.85"/>
  <rect x="36" y="36" width="${WIDTH - 72}" height="${HEIGHT - 72}" fill="none" stroke="${p.accent}" stroke-width="1" stroke-opacity="0.6"/>
</svg>`;
}

function panel(p: Palette, top: number, height: number, dividerY: number): string {
  const cx = WIDTH / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <rect x="62" y="${top}" width="${WIDTH - 124}" height="${height}" rx="18" fill="#000000" fill-opacity="0.28"
        stroke="${p.accent}" stroke-opacity="0.45" stroke-width="1.2"/>
  <g stroke="${p.accent}" stroke-width="1.6" stroke-opacity="0.9">
    <line x1="${cx - 120}" y1="${dividerY}" x2="${cx - 22}" y2="${dividerY}"/>
    <line x1="${cx + 22}" y1="${dividerY}" x2="${cx + 120}" y2="${dividerY}"/>
  </g>
  <rect x="${cx - 8}" y="${dividerY - 8}" width="16" height="16" transform="rotate(45 ${cx} ${dividerY})" fill="${p.accent}"/>
</svg>`;
}

export interface CoverSpec {
  title: string;
  author: string;
  category: CategoryId;
}

/** A 600×900 JPEG cover for a book without one. */
export async function generateCover({ title, author, category }: CoverSpec): Promise<Uint8Array> {
  const seed = hash(title + author);
  const p = PALETTES[category][seed % 2];
  const cleanTitle = title.replace(/\s+/g, " ").trim().slice(0, 120) || "كتاب";
  const cleanAuthor = author.replace(/\s+/g, " ").trim().slice(0, 80);

  let size = titleSize(cleanTitle);
  let titleImg = await textImage(cleanTitle, "title", size, p.ink, 440);
  while (titleImg.height > 380 && size > 32) {
    size -= 6;
    titleImg = await textImage(cleanTitle, "title", size, p.ink, 440);
  }
  const authorImg = cleanAuthor ? await textImage(cleanAuthor, "body", 32, p.accent, 420) : null;
  const labelImg = await textImage(LABELS[category], "label", 22, p.accent, 400);
  const brandImg = await textImage("مكتبة أرنوبة", "label", 18, p.accent, 300);

  const gap = 56;
  const blockHeight = titleImg.height + (authorImg ? gap + authorImg.height : 0);
  const panelPad = 44;
  const panelTop = Math.max(150, Math.round(440 - blockHeight / 2 - panelPad));
  const titleTop = panelTop + panelPad;
  const dividerY = titleTop + titleImg.height + gap / 2;
  const panelHeight = blockHeight + panelPad * 2;
  const center = (w: number) => Math.round((WIDTH - w) / 2);

  const layers: OverlayOptions[] = [
    { input: Buffer.from(panel(p, panelTop, panelHeight, authorImg ? dividerY : -100)), top: 0, left: 0 },
    { input: labelImg.data, top: 84, left: center(labelImg.width) },
    { input: titleImg.data, top: titleTop, left: center(titleImg.width) },
    { input: brandImg.data, top: HEIGHT - 96, left: center(brandImg.width) },
  ];
  if (authorImg) layers.push({ input: authorImg.data, top: titleTop + titleImg.height + gap, left: center(authorImg.width) });

  const out = await sharp(Buffer.from(background(p, seed >> 1)))
    .composite(layers)
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
  return new Uint8Array(out);
}
