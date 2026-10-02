// Serves locally stored book files and covers (only when no bucket is
// configured). Supports HTTP Range so pdf.js can stream large PDFs.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { contentTypeFor, isValidKey, localPath, storageMode } from "@/lib/storage";
import { contentDisposition, fileNameFor } from "@/lib/text";

const notFound = () => new Response("Not found", { status: 404 });

async function serve(req: Request, params: Promise<{ key: string[] }>, withBody: boolean) {
  if (storageMode() !== "local") return notFound();
  const key = (await params).key.join("/");
  if (!isValidKey(key)) return notFound();
  const file = localPath(key);
  let size: number;
  try {
    size = (await stat(file)).size;
  } catch {
    return notFound();
  }

  const headers = new Headers({
    "Content-Type": contentTypeFor(key),
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
  });
  // Book files are always attachments, so a PDF or EPUB can never be opened as
  // a page on our origin (the readers fetch them, which ignores this header).
  if (key.startsWith("books/")) {
    const ext = key.slice(key.lastIndexOf(".") + 1);
    const requested = new URL(req.url).searchParams.get("dl") ?? "book";
    const base = requested.replace(/\.[a-z0-9]{1,5}$/i, "").slice(0, 200);
    headers.set("Content-Disposition", contentDisposition(fileNameFor(base, "", ext)));
  }

  let start = 0;
  let end = size - 1;
  let status = 200;
  const range = req.headers.get("range");
  if (range && size > 0) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match && (match[1] || match[2])) {
      if (match[1] === "") {
        start = Math.max(0, size - Number(match[2]));
      } else {
        start = Number(match[1]);
        end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
      }
      if (start > end || start >= size) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      }
      status = 206;
      headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    }
  }
  headers.set("Content-Length", String(size === 0 ? 0 : end - start + 1));
  if (!withBody || size === 0) return new Response(null, { status, headers });
  const stream = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream<Uint8Array>;
  return new Response(stream, { status, headers });
}

export function GET(req: Request, ctx: RouteContext<"/files/[...key]">) {
  return serve(req, ctx.params, true);
}

export function HEAD(req: Request, ctx: RouteContext<"/files/[...key]">) {
  return serve(req, ctx.params, false);
}
