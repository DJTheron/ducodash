import { useMemo } from 'react';
import type { HistoricPrice } from '../../api/schema';
import { formatDuco, formatUnitPrice } from '../../lib/format';
import type { WalletStats } from '../../stats/derive';
import { Section } from '../Section';
import { LineChart, type Point } from './LineChart';

const shortDate = (t: number) =>
  new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export function ChartsPanel({
  prices,
  wallet,
}: {
  prices: HistoricPrice[];
  wallet: WalletStats | null;
}) {
  /*
    The server records a collector failure as `price: 0`, not as a missing row.
    Plotting those verbatim draws a cliff to zero and back on an otherwise flat
    series, so zeros are dropped as the gaps they are.
  */
  const priceSeries = useMemo<Point[]>(
    () =>
      prices
        .filter((p) => p.price > 0)
        .map((p) => ({ t: p.day_unix * 1000, value: p.price }))
        .sort((a, b) => a.t - b.t),
    [prices],
  );

  const balanceSeries = useMemo<Point[]>(
    () => (wallet?.history ?? []).map((p) => ({ t: p.t, value: p.balance })),
    [wallet],
  );

  const gaps = prices.length - priceSeries.length;

  return (
    <Section title="Over time">
      <div className="grid gap-3 lg:grid-cols-2">
        <figure className="card p-5">
          <figcaption className="mb-1">
            <h3 className="text-sm font-medium text-ink">Best exchange rate</h3>
            <p className="text-xs text-ink-muted">
              The best price available anywhere each day, as recorded by the Duino-Coin server
              {gaps > 0 && ` · ${gaps} day${gaps === 1 ? '' : 's'} not recorded`}
            </p>
          </figcaption>
          <LineChart
            points={priceSeries}
            label="Best DUCO exchange rate per day, in US dollars"
            format={formatUnitPrice}
            formatX={shortDate}
          />
        </figure>

        <figure className="card p-5">
          <figcaption className="mb-1">
            <h3 className="text-sm font-medium text-ink">Balance</h3>
            <p className="text-xs text-ink-muted">
              Reconstructed by replaying transfers back from today. Mining income has no
              transaction, so it shows as the drift between steps rather than as jumps.
            </p>
          </figcaption>
          <LineChart
            points={balanceSeries}
            label="Reconstructed DUCO balance over time"
            format={(v) => formatDuco(v, 0)}
            formatX={shortDate}
          />
        </figure>
      </div>
    </Section>
  );
}
