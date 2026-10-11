import type { ReactNode } from 'react';

/** Stands in for a portal until its phase builds it. Replaced by real shells in Phase 4. */
export function PlaceholderPage({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children?: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Takhti
      </p>
      <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
      <p className="text-muted-foreground">{note}</p>
      {children}
    </main>
  );
}
