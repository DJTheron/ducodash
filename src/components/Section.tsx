import type { ReactNode } from 'react';

/** Consistent section frame: serif heading, optional subtitle, optional right slot. */
export function Section({
  title,
  subtitle,
  aside,
  children,
}: {
  title: string;
  subtitle?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
        <div>
          <h2 className="font-display text-2xl leading-tight text-ink sm:text-3xl">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** Label / value / optional footnote. The dashboard's basic unit of information. */
export function StatTile({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'muted';
}) {
  return (
    <div className="card p-4">
      <dt className="text-xs font-medium text-ink-muted">{label}</dt>
      <dd
        className={`mt-1 font-display text-2xl leading-none ${tone === 'muted' ? 'text-ink-2' : 'text-ink'}`}
      >
        {value}
      </dd>
      {hint && <p className="mt-1.5 text-xs leading-snug text-ink-muted">{hint}</p>}
    </div>
  );
}
