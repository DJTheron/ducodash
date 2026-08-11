import { useMemo } from 'react';
import type { Miner } from '../../api/schema';
import { formatCompact, formatDuco, formatHashrate, formatPercent } from '../../lib/format';
import { classifyMiner, densityFor, summariseFleet, type Density } from '../../miners/classify';
import { HashWave } from './HashWave';
import { MinerGlyph } from './MinerGlyph';
import { ShareArc } from './ShareArc';
import { Section } from '../Section';

/*
  Card sizing by fleet size.

  Four rigs shouldn't rattle around inside a grid built for a hundred, and a hundred
  shouldn't need a scroll each. The tier picks the card geometry, which visualisers
  are worth drawing, and how much metadata survives — so both fleets fill the same
  space comfortably.
*/
const TIER = {
  showcase: {
    grid: 'grid-cols-1 sm:grid-cols-2',
    arc: 88,
    wave: { width: 190, height: 42 },
    padding: 'p-5',
  },
  compact: {
    grid: 'grid-cols-2 lg:grid-cols-3',
    arc: 58,
    wave: { width: 128, height: 30 },
    padding: 'p-3.5',
  },
  dense: {
    grid: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8',
    arc: 40,
    wave: { width: 76, height: 20 },
    padding: 'p-2.5',
  },
} satisfies Record<Density, unknown>;

function MinerCard({
  miner,
  peak,
  density,
  history,
}: {
  miner: Miner;
  peak: number;
  density: Density;
  history?: number[];
}) {
  const tier = TIER[density];
  const kind = classifyMiner(miner);
  const name = miner.identifier && miner.identifier !== 'None' ? miner.identifier : kind;
  const dense = density === 'dense';

  return (
    <article
      className={`card ${tier.padding} flex flex-col gap-2 transition hover:border-accent/50`}
      title={`${miner.software} · ${formatHashrate(miner.hashrate)} · ${formatCompact(miner.accepted)} shares · difficulty ${formatCompact(miner.diff)}${miner.pool ? ` · ${miner.pool}` : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <MinerGlyph kind={kind} className={dense ? 'h-4 w-4 text-ink-2' : 'h-5 w-5 text-ink-2'} />
            <span
              className={`truncate font-medium text-ink ${dense ? 'text-[11px]' : 'text-sm'}`}
            >
              {name}
            </span>
          </div>
          {!dense && (
            <p className="mt-0.5 truncate text-xs text-ink-muted" title={miner.software}>
              {miner.software}
            </p>
          )}
        </div>
        {!dense && (
          <span className="eyebrow shrink-0 rounded-full bg-paper-sunk px-2 py-0.5">{kind}</span>
        )}
      </div>

      <div className={`flex items-center gap-3 ${dense ? 'justify-between' : ''}`}>
        <ShareArc
          accepted={miner.accepted}
          rejected={miner.rejected}
          size={tier.arc}
          label={!dense}
        />
        <div className="min-w-0 flex-1">
          <div
            className={`tnum font-display text-ink ${dense ? 'text-sm' : 'text-xl'}`}
            title="Current hashrate"
          >
            {formatHashrate(miner.hashrate)}
          </div>
          <HashWave
            hashrate={miner.hashrate}
            peak={peak}
            sharetime={miner.sharetime}
            history={history}
            width={tier.wave.width}
            height={tier.wave.height}
          />
        </div>
      </div>

      {density === 'showcase' && (
        <dl className="mt-1 grid grid-cols-3 gap-2 border-t border-rule pt-2.5 text-xs">
          <div>
            <dt className="text-ink-muted">Difficulty</dt>
            <dd className="tnum mt-0.5 text-ink-2">{formatCompact(miner.diff)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Share time</dt>
            <dd className="tnum mt-0.5 text-ink-2">{miner.sharetime.toFixed(2)}s</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Rejected</dt>
            <dd className="tnum mt-0.5 text-ink-2">{formatCompact(miner.rejected)}</dd>
          </div>
        </dl>
      )}
    </article>
  );
}

export function MinerFleet({
  miners,
  history,
}: {
  miners: Miner[];
  history: Map<string, number[]>;
}) {
  const summary = useMemo(() => summariseFleet(miners), [miners]);
  const density = densityFor(miners.length);
  const tier = TIER[density];

  // Fastest rig sets the amplitude scale for every wave, so the cards are
  // comparable to each other rather than each self-normalised.
  const peak = useMemo(() => Math.max(1, ...miners.map((m) => m.hashrate)), [miners]);

  const sorted = useMemo(
    () => [...miners].sort((a, b) => b.hashrate - a.hashrate),
    [miners],
  );

  if (miners.length === 0) {
    return (
      <Section title="Rigs" subtitle="No miners are reporting for this account right now.">
        <p className="card p-6 text-sm text-ink-2">
          Nothing is mining under this username at the moment. Rigs appear here within a minute
          of connecting.
        </p>
      </Section>
    );
  }

  return (
    <Section
      title="Rigs"
      subtitle={`${summary.count} ${summary.count === 1 ? 'rig' : 'rigs'} · ${formatHashrate(summary.hashrate)} · ${formatDuco(summary.accepted, 0)} shares accepted`}
    >
      {/* Fleet composition. Doubles as the legend for the glyphs used on the cards. */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {summary.byKind.map(({ kind, count, hashrate }) => (
          <span key={kind} className="inline-flex items-center gap-1.5 text-xs text-ink-2">
            <MinerGlyph kind={kind} className="h-4 w-4 text-ink-muted" />
            <span className="font-medium text-ink">{count}</span>
            <span>{kind}</span>
            <span className="text-ink-muted">{formatHashrate(hashrate)}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
          <span className="text-ink-muted">Accepted</span>
          <span className="font-medium text-ink">{formatPercent(summary.acceptRate, 2)}</span>
        </span>
      </div>

      <div className={`grid gap-3 ${tier.grid}`}>
        {sorted.map((miner) => (
          <MinerCard
            key={miner.threadid}
            miner={miner}
            peak={peak}
            density={density}
            history={history.get(miner.threadid)}
          />
        ))}
      </div>
    </Section>
  );
}
