import type { Statistics } from '../api/schema';
import { formatCompact, formatDuco, formatPercent } from '../lib/format';
import { Section, StatTile } from './Section';

/**
 * Network-wide miner mix.
 *
 * Part-to-whole across nine hardware classes — a stacked bar rather than a donut,
 * because the categories have long names and the tail is tiny. Ordered by size, with
 * a 2px surface gap between segments.
 */
function DistributionBar({ distribution }: { distribution: Record<string, number> }) {
  const entries = Object.entries(distribution)
    .filter(([key, value]) => key !== 'All' && value > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total === 0) return null;

  // Sequential ramp: one hue, darkest for the largest class. Magnitude, not identity.
  const shade = (i: number) => {
    const steps = ['#c2532a', '#d9642f', '#eb6834', '#f08a5f', '#f4a888', '#f7c4ad', '#f7d9cb'];
    return steps[Math.min(i, steps.length - 1)];
  };

  return (
    <div className="card p-5">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-ink">Miners by hardware</h3>
        <span className="tnum text-sm text-ink-2">{formatCompact(total)} online</span>
      </div>
      <div className="flex h-7 w-full gap-[2px] overflow-hidden rounded-md">
        {entries.map(([key, value], i) => (
          <div
            key={key}
            className="h-full first:rounded-l-md last:rounded-r-md"
            style={{ width: `${(value / total) * 100}%`, background: shade(i) }}
            title={`${key}: ${formatCompact(value)} (${formatPercent(value / total)})`}
          />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-5 gap-y-1 sm:grid-cols-3">
        {entries.map(([key, value], i) => (
          <li key={key} className="flex items-baseline gap-2 text-sm">
            <span
              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ background: shade(i) }}
              aria-hidden="true"
            />
            <span className="flex-1 truncate text-ink-2">{key}</span>
            <span className="tnum shrink-0 text-xs text-ink-muted">
              {formatPercent(value / total, 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NetworkPanel({ statistics }: { statistics: Statistics }) {
  const distribution = statistics['Miner distribution'];
  const rich = statistics['Top 10 richest miners'] ?? [];

  return (
    <Section
      title="The network"
      subtitle={statistics['Last update'] ? `Server last updated ${statistics['Last update']}` : undefined}
    >
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="grid grid-cols-2 gap-3 lg:col-span-1">
          <StatTile label="Pool hashrate" value={statistics['Pool hashrate'] ?? '—'} />
          <StatTile
            label="Miners online"
            value={formatCompact(distribution?.All ?? 0)}
            hint={`${formatCompact(statistics['Active connections'] ?? 0)} connections`}
          />
          <StatTile
            label="Registered"
            value={formatCompact(statistics['Registered users'] ?? 0)}
            hint="accounts"
          />
          <StatTile
            label="Energy"
            value={statistics['Net energy usage'] ?? '—'}
            hint="whole network"
          />
        </div>

        <div className="lg:col-span-2">
          {distribution && <DistributionBar distribution={distribution} />}
        </div>
      </div>

      {rich.length > 0 && (
        <div className="card mt-3 p-5">
          <h3 className="mb-3 text-sm font-medium text-ink">Largest holders</h3>
          <ol className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {rich.slice(0, 6).map((entry, i) => {
              // Entries arrive pre-formatted as "12345.678 DUCO - username".
              const [amount = '', name = ''] = entry.split(' DUCO - ');
              return (
                <li key={entry} className="flex items-baseline gap-2 text-sm">
                  <span className="tnum w-4 shrink-0 text-xs text-ink-muted">{i + 1}</span>
                  <span className="flex-1 truncate text-ink-2">{name}</span>
                  <span className="tnum shrink-0 text-ink">
                    {formatDuco(Number(amount) || 0, 0)}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </Section>
  );
}
