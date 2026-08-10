import { formatDuco, formatPercent } from '../../lib/format';
import { INFLOW_LABELS, OUTFLOW_LABELS } from '../../stats/classify';
import type { FlowTotals } from '../../stats/derive';

/*
  Where the balance came from, and where it went.

  Part-to-whole across a handful of named categories, so: stacked bar, categorical
  colour, horizontal because the category names are long. Segments are separated by
  a 2px gap in the surface colour rather than by strokes.

  Slots are assigned in fixed order from the validated categorical palette and never
  reassigned by rank — "faucets" is the same colour whether it's the largest source
  or the smallest.
*/
const SOURCE_COLORS: Record<string, string> = {
  mined: 'var(--color-series-1)',
  faucet: 'var(--color-series-2)',
  rewards: 'var(--color-series-3)',
  exchange: 'var(--color-series-4)',
  unwrapped: 'var(--color-series-5)',
  lottery: 'var(--color-series-6)',
  received: 'var(--color-baseline)',
};

const USE_COLORS: Record<string, string> = {
  sent: 'var(--color-series-2)',
  wrapped: 'var(--color-series-3)',
  exchangeOut: 'var(--color-series-4)',
  lotteryOut: 'var(--color-series-6)',
  burned: 'var(--color-series-1)',
};

type Segment = { key: string; label: string; value: number; color: string };

function Bar({
  segments,
  total,
  caption,
}: {
  segments: Segment[];
  total: number;
  caption: string;
}) {
  if (total <= 0) {
    return <p className="text-sm text-ink-muted">{caption}: nothing recorded.</p>;
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-ink">{caption}</h3>
        <span className="tnum text-sm text-ink-2">{formatDuco(total, 0)} DUCO</span>
      </div>

      {/* gap-[2px] is the surface gap that separates touching segments. */}
      <div className="flex h-7 w-full gap-[2px] overflow-hidden rounded-md">
        {segments.map((s) => (
          <div
            key={s.key}
            className="h-full first:rounded-l-md last:rounded-r-md"
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${formatDuco(s.value, 0)} DUCO (${formatPercent(s.value / total)})`}
          />
        ))}
      </div>

      {/*
        Legend is always present — identity must never depend on colour alone.
        Single column: these category names are long, and a second column only buys
        space by truncating them, which defeats the point of having a legend.
      */}
      <ul className="mt-3 space-y-1.5">
        {segments.map((s) => (
          <li key={s.key} className="flex items-baseline gap-2 text-sm">
            <span
              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ background: s.color }}
              aria-hidden="true"
            />
            <span className="flex-1 text-ink-2">{s.label}</span>
            <span className="tnum shrink-0 font-medium text-ink">{formatDuco(s.value, 0)}</span>
            <span className="tnum w-10 shrink-0 text-right text-xs text-ink-muted">
              {formatPercent(s.value / total, 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FlowBar({ flows }: { flows: FlowTotals }) {
  const sources: Segment[] = [
    {
      key: 'mined',
      label: flows.minedIsReliable ? 'Mined' : 'Mined (estimated)',
      value: flows.mined,
      color: SOURCE_COLORS.mined!,
    },
    ...Object.entries(flows.inflow).map(([key, value]) => ({
      key,
      label: INFLOW_LABELS[key as keyof typeof INFLOW_LABELS],
      value,
      color: SOURCE_COLORS[key] ?? 'var(--color-baseline)',
    })),
  ]
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);

  const uses: Segment[] = Object.entries(flows.outflow)
    .map(([key, value]) => ({
      key,
      label: OUTFLOW_LABELS[key as keyof typeof OUTFLOW_LABELS],
      value,
      color: USE_COLORS[key] ?? 'var(--color-baseline)',
    }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);

  const totalSources = sources.reduce((a, s) => a + s.value, 0);
  const totalUses = uses.reduce((a, s) => a + s.value, 0);

  return (
    <div className="card grid gap-8 p-5 sm:p-6 lg:grid-cols-2">
      <Bar segments={sources} total={totalSources} caption="Where it came from" />
      <Bar segments={uses} total={totalUses} caption="Where it went" />

      {!flows.minedIsReliable && (
        <p className="text-xs leading-relaxed text-ink-muted lg:col-span-2">
          Mining rewards are credited straight to the balance and never appear as
          transactions, so the mined figure is what's left once every transfer is accounted
          for. For this account the transfers don't fully reconcile — usually a history long
          enough to hit the API's row limit — so treat it as an estimate.
        </p>
      )}
    </div>
  );
}
