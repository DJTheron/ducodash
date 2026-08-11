import { useState } from 'react';
import { formatDate, formatDuco, parseDucoDate } from '../lib/format';
import { INFLOW_LABELS, OUTFLOW_LABELS, type ClassifiedTransaction } from '../stats/classify';
import { Section } from './Section';

const PAGE = 12;

function kindLabel(tx: ClassifiedTransaction): string {
  return tx.direction === 'in'
    ? (INFLOW_LABELS[tx.kind as keyof typeof INFLOW_LABELS] ?? 'Received')
    : (OUTFLOW_LABELS[tx.kind as keyof typeof OUTFLOW_LABELS] ?? 'Sent');
}

export function TransactionFeed({ transactions }: { transactions: ClassifiedTransaction[] }) {
  const [shown, setShown] = useState(PAGE);
  // Newest first for reading; the stats engine keeps them oldest-first internally.
  const ordered = [...transactions].reverse();
  const visible = ordered.slice(0, shown);

  if (transactions.length === 0) {
    return (
      <Section title="Transactions" subtitle="No transfers on this account yet.">
        <p className="card p-6 text-sm text-ink-2">
          Mining income doesn't create transactions, so an account that only mines will show
          nothing here.
        </p>
      </Section>
    );
  }

  return (
    <Section
      title="Transactions"
      subtitle={`${transactions.length.toLocaleString('en-US')} transfers, newest first`}
    >
      <ul className="card divide-y divide-rule">
        {visible.map((tx) => {
          const incoming = tx.direction === 'in';
          const date = parseDucoDate(tx.datetime);
          return (
            <li key={`${tx.id}-${tx.hash}`} className="flex items-center gap-3 px-4 py-3">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  incoming ? 'bg-accent-soft text-ink' : 'bg-paper-sunk text-ink-2'
                }`}
                aria-hidden="true"
              >
                {incoming ? '↓' : '↑'}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="truncate text-sm font-medium text-ink">
                    {incoming ? 'From' : 'To'} {tx.counterparty}
                  </span>
                  <span className="eyebrow">{kindLabel(tx)}</span>
                </div>
                {tx.memo && tx.memo !== 'None' && (
                  <p className="truncate text-xs text-ink-muted" title={tx.memo}>
                    {tx.memo}
                  </p>
                )}
              </div>

              <div className="shrink-0 text-right">
                <div className="tnum text-sm font-medium text-ink">
                  {incoming ? '+' : '−'}
                  {formatDuco(Math.abs(tx.amount))}
                </div>
                <div className="text-xs text-ink-muted">{formatDate(date)}</div>
              </div>

              <a
                href={`https://explorer.duinocoin.com/?search=${tx.hash}`}
                target="_blank"
                rel="noreferrer noopener"
                className="shrink-0 font-mono text-[10px] text-ink-muted underline decoration-rule underline-offset-2 hover:text-ink"
                title={`View ${tx.hash} in the Duino-Coin explorer`}
              >
                {tx.hash.slice(0, 6)}
              </a>
            </li>
          );
        })}
      </ul>

      {shown < ordered.length && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE * 2)}
          className="mt-3 w-full rounded-lg border border-rule bg-paper-card py-2 text-sm font-medium text-ink-2 transition hover:border-accent hover:text-ink"
        >
          Show more ({(ordered.length - shown).toLocaleString('en-US')} remaining)
        </button>
      )}
    </Section>
  );
}
