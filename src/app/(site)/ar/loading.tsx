export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-2" />
      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i}>
            <div className="aspect-[2/3] animate-pulse rounded-lg bg-surface-2" />
            <div className="mt-3 h-3.5 w-4/5 animate-pulse rounded bg-surface-2" />
            <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
