"use client";

import dynamic from "next/dynamic";
import type { ReaderProps } from "./Reader";

// The reader depends on localStorage and browser-only libraries, so it is
// never rendered on the server.
const Reader = dynamic(() => import("./Reader"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-bg text-sm text-muted">جارٍ فتح القارئ…</div>
  ),
});

export function ReaderClient(props: ReaderProps) {
  return <Reader {...props} />;
}
