/** Placeholder while an account page loads its data. */
export function AccountPageSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <div className="h-3 w-28 animate-pulse bg-paper-2" />
      <div className="h-16 w-3/4 animate-pulse bg-paper-2" />
      <div className="h-4 w-1/2 animate-pulse bg-paper-2" />
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-48 animate-pulse bg-paper-2" />
        ))}
      </div>
    </div>
  );
}
