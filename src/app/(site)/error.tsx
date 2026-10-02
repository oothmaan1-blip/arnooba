"use client";

import { useEffect } from "react";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">حدث خطأ غير متوقع</h1>
      <p className="mt-2 text-muted">نعتذر عن ذلك. حاول مرة أخرى بعد لحظات.</p>
      <button type="button" onClick={reset} className="btn-primary mt-6">
        إعادة المحاولة
      </button>
    </div>
  );
}
