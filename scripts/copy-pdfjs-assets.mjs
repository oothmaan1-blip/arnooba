// Copies pdf.js's worker, fonts, cmaps and wasm decoders into public/pdfjs so
// the browser loads the exact same version as the pdfjs-dist package.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const pkgDir = path.dirname(require.resolve("pdfjs-dist/package.json"));
const outDir = path.join(process.cwd(), "public", "pdfjs");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(path.join(pkgDir, "build", "pdf.worker.min.mjs"), path.join(outDir, "pdf.worker.min.mjs"));
for (const dir of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  const from = path.join(pkgDir, dir);
  if (existsSync(from)) cpSync(from, path.join(outDir, dir), { recursive: true });
}
console.log("pdf.js assets copied to public/pdfjs");
