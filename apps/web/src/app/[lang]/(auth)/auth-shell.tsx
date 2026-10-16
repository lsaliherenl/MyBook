/** Split editorial layout for the sign-in pages: a plum panel beside the form. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid flex-1 md:grid-cols-2">
      <div className="hidden bg-plum-900 md:block" aria-hidden />
      <div className="flex items-center justify-center px-4 py-16 sm:px-8">
        <div className="w-full max-w-md">
          <h1 className="font-serif text-4xl sm:text-5xl">{title}</h1>
          <p className="mt-3 font-serif text-lg text-ink-muted">{subtitle}</p>
          <div className="mt-10">{children}</div>
        </div>
      </div>
    </div>
  );
}
