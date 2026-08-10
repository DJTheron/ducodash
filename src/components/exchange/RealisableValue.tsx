import { useState } from 'react';
import { formatPercent, formatUnitPrice, formatUsd } from '../../lib/format';
import { betterUnverifiedQuote, realisedValue } from '../../exchange/report';
import type { ExchangeReport, Provenance } from '../../exchange/types';
import { VenueTable } from './VenueTable';

const PROVENANCE_COPY: Record<Provenance, { label: string; detail: string }> = {
  realisable: {
    label: 'Realisable',
    detail:
      'Simulated against live pool reserves for your exact balance, after swap fees and estimated network costs.',
  },
  quoted: {
    label: 'Quoted only',
    detail:
      "The venue's advertised price. We could not read its depth, so a large sell may not fill anywhere near this.",
  },
  nominal: {
    label: 'Nominal',
    detail: "The server's headline price. A reference number, not an obtainable one.",
  },
};

function ProvenanceBadge({ provenance }: { provenance: Provenance }) {
  const copy = PROVENANCE_COPY[provenance];
  const tone =
    provenance === 'realisable'
      ? 'bg-accent-soft text-ink'
      : 'border border-rule bg-paper-sunk text-ink-2';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone}`}
      title={copy.detail}
    >
      {copy.label}
    </span>
  );
}

function Arrow() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M4 8h7M8.5 4.5 12 8l-3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RealisableValue({
  report,
  balance,
}: {
  report: ExchangeReport | null;
  balance: number;
}) {
  const [open, setOpen] = useState(false);

  if (!report) {
    return (
      <div className="mt-4 h-16 animate-pulse text-center text-sm text-ink-muted">
        Reading pool depth…
      </div>
    );
  }

  const best = report.best;
  const better = betterUnverifiedQuote(report);
  const value = best ? realisedValue(best) : 0;
  const unprofitable = best?.netUsd !== null && best?.netUsd !== undefined && best.netUsd <= 0;
  const shortfall =
    report.nominalTotalUsd > 0 ? 1 - value / report.nominalTotalUsd : 0;

  return (
    <section className="mx-auto mt-5 w-full max-w-2xl px-4 text-center">
      {best && best.status === 'ok' && !unprofitable ? (
        <>
          <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1">
            <span className="font-display text-4xl text-ink sm:text-5xl">{formatUsd(value)}</span>
            <ProvenanceBadge provenance={best.provenance} />
          </div>

          <a
            href={best.venue.url}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-rule bg-paper-card px-4 py-2 text-sm font-medium text-ink transition hover:border-accent hover:bg-accent-soft"
          >
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
            {best.venue.label}
            <span className="text-ink-muted">·</span>
            <span className="text-ink-2">{best.venue.chain}</span>
            <Arrow />
          </a>

          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-ink-2">
            {best.venue.route.join(' → ')}.
          </p>

          {/*
            The core comparison. Naming the headline price and the gap to it is the
            entire point of the panel — without it the realisable number is just
            another figure with no context.
          */}
          <p className="mx-auto mt-2 max-w-lg text-sm text-ink-muted">
            The headline price says {formatUsd(report.nominalTotalUsd)}
            {shortfall > 0.01 && (
              <>
                {' '}
                — <strong className="font-semibold text-ink-2">
                  {formatPercent(shortfall, 0)} more
                </strong>{' '}
                than you could actually get
              </>
            )}
            {best.priceImpact > 0.005 && (
              <> · {formatPercent(best.priceImpact)} of that is lost to price impact alone</>
            )}
            .
          </p>
        </>
      ) : (
        <div className="mx-auto max-w-lg">
          <div className="flex items-baseline justify-center gap-3">
            <span className="font-display text-3xl text-ink-2">
              {best ? formatUsd(Math.max(0, value)) : '—'}
            </span>
            <ProvenanceBadge provenance={best?.provenance ?? 'nominal'} />
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            {best?.note ??
              (unprofitable
                ? `Every route out costs more in fees than the coins would fetch. The best market (${best?.venue.label}) would return ${formatUsd(best?.grossUsd ?? 0)} against roughly ${formatUsd(best?.costUsd ?? 0)} of network cost.`
                : 'No venue could be priced right now.')}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Headline price would value this at {formatUsd(report.nominalTotalUsd)}.
          </p>
        </div>
      )}

      {better && (
        <p className="mx-auto mt-3 max-w-lg rounded-lg border border-rule bg-paper-card px-3 py-2 text-xs leading-relaxed text-ink-2">
          <strong className="font-semibold">{better.venue.label}</strong> advertises a better rate
          at {formatUsd(better.grossUsd)}, but publishes no depth — so we can't confirm a sell that
          size would fill. Treated as unverified rather than promoted above.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span>
          Headline {formatUnitPrice(report.nominalUsd)}
          <span className="mx-1">·</span>
          {balance > 0 && best ? `you'd get ${formatUnitPrice(best.effectiveUsd)}` : 'per DUCO'}
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="font-medium text-ink-2 underline decoration-rule underline-offset-4 transition hover:text-ink hover:decoration-accent"
          aria-expanded={open}
        >
          {open ? 'Hide' : 'Compare'} all {report.quotes.length} venues
        </button>
      </div>

      {open && <VenueTable report={report} />}

      {report.errors.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-ink-muted">
          {report.errors.map((e) => (
            <li key={e}>⚠ {e}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
