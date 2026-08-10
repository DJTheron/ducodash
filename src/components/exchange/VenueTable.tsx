import { formatPercent, formatUnitPrice, formatUsd } from '../../lib/format';
import { realisedValue } from '../../exchange/report';
import type { ExchangeReport, VenueQuote } from '../../exchange/types';

function StatusCell({ quote }: { quote: VenueQuote }) {
  if (quote.status === 'dead') {
    return (
      <span className="inline-flex items-center gap-1 text-ink-muted" title={quote.note}>
        <span aria-hidden="true">○</span> No market
      </span>
    );
  }
  if (quote.status === 'unavailable') {
    return (
      <span className="inline-flex items-center gap-1 text-ink-2" title={quote.note}>
        <span aria-hidden="true">◐</span> Unavailable
      </span>
    );
  }
  if (quote.provenance === 'realisable') {
    return (
      <span className="inline-flex items-center gap-1 text-ink" title="Depth simulated on-chain">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" /> Depth modelled
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-ink-2" title={quote.note}>
      <span aria-hidden="true">~</span> Quote only
    </span>
  );
}

/**
 * The full venue comparison — also the accessible table view for the numbers the
 * hero panel summarises.
 */
export function VenueTable({ report }: { report: ExchangeReport }) {
  return (
    <div className="card mt-4 overflow-x-auto text-left">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <caption className="px-4 pt-3 text-left text-xs text-ink-muted">
          What each venue would pay for your balance. Ranked by proceeds after fees where
          those could be modelled.
        </caption>
        <thead>
          <tr className="border-b border-rule text-left">
            <th scope="col" className="px-4 py-2 font-medium text-ink-2">
              Venue
            </th>
            <th scope="col" className="px-4 py-2 font-medium text-ink-2">
              Basis
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium text-ink-2">
              Per DUCO
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium text-ink-2">
              Impact
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium text-ink-2">
              Depth
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium text-ink-2">
              You get
            </th>
          </tr>
        </thead>
        <tbody>
          {report.quotes.map((quote) => {
            const dead = quote.status !== 'ok';
            return (
              <tr
                key={quote.venue.id}
                className={`border-b border-rule/60 last:border-0 ${dead ? 'opacity-55' : ''}`}
              >
                <th scope="row" className="px-4 py-2 text-left font-medium">
                  <a
                    href={quote.venue.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-ink underline decoration-rule underline-offset-4 hover:decoration-accent"
                  >
                    {quote.venue.label}
                  </a>
                  <span className="block text-xs font-normal text-ink-muted">
                    {quote.venue.chain}
                  </span>
                </th>
                <td className="px-4 py-2">
                  <StatusCell quote={quote} />
                </td>
                <td className="tnum px-4 py-2 text-right text-ink-2">
                  {dead ? '—' : formatUnitPrice(quote.effectiveUsd)}
                </td>
                <td className="tnum px-4 py-2 text-right text-ink-2">
                  {quote.provenance === 'realisable' ? formatPercent(quote.priceImpact) : '—'}
                </td>
                <td className="tnum px-4 py-2 text-right text-ink-2">
                  {quote.liquidityUsd === null ? '—' : formatUsd(quote.liquidityUsd)}
                </td>
                <td className="tnum px-4 py-2 text-right font-semibold text-ink">
                  {dead ? '—' : formatUsd(realisedValue(quote))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-4 pb-3 pt-2 text-xs leading-relaxed text-ink-muted">
        Depth is the total value in the pool, both sides. Impact is what the pool's size costs
        you at this trade size. Network costs are estimates: live gas price on BNB Chain, and
        roughly 5 TRX on TRON.
      </p>
    </div>
  );
}
