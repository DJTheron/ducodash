import { useMemo, useState } from 'react';
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
    // 4 columns on wide screens: at 3 the cards stretch to ~500px for ~170px of
    // content and the wave becomes a long flat ribbon.
    grid: 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    arc: 58,
    wave: { width: 128, height: 30 },
    padding: 'p-3.5',
  },
  dense: {
    // 2 columns on phones, not 3: at 3 a 414px screen gives ~110px cards and every
    // rig name truncates to "workshop-p…", which is no name at all.
    grid: 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8',
    arc: 0,
    wave: { width: 76, height: 20 },
    padding: 'p-2.5',
  },
} satisfies Record<Density, unknown>;

/** A rig worth looking at: rejecting materially more than the fleet norm. */
const REJECT_ALERT = 0.02;

/**
 * Cards shown before the dense tier folds behind an expander.
 *
 * A hundred rigs at two columns is fifty rows of phone scrolling. The fleet summary
 * above already answers "how is it doing", so the grid leads with the fastest rigs
 * and keeps the rest one tap away.
 */
const DENSE_VISIBLE = 48;

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
  const shares = miner.accepted + miner.rejected;
  const rejectRate = shares > 0 ? miner.rejected / shares : 0;

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

      {/*
        No share ring in the dense tier. At 40px it carries no readable value — the
        per-rig share count isn't scannable across a hundred cards anyway, and the
        fleet total is already in the section header. The space goes to the rig's
        name and rate, and rejects switch to exception-based: only a rig actually
        misbehaving gets a marker, so problems stand out of the wall instead of
        every card wearing an identical ring.
      */}
      <div className={`flex items-center gap-3 ${dense ? 'justify-between' : ''}`}>
        {!dense && (
          <ShareArc accepted={miner.accepted} rejected={miner.rejected} size={tier.arc} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span
              className={`tnum font-display text-ink ${dense ? 'text-sm' : 'text-xl'}`}
              title="Current hashrate"
            >
              {formatHashrate(miner.hashrate)}
            </span>
            {dense && rejectRate > REJECT_ALERT && (
              <span
                className="text-[10px] font-semibold text-critical"
                title={`${formatCompact(miner.rejected)} rejected of ${formatCompact(miner.accepted + miner.rejected)} shares`}
              >
                ▲ {formatPercent(rejectRate, 0)}
              </span>
            )}
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

  const [expanded, setExpanded] = useState(false);
  const capped = density === 'dense' && !expanded && sorted.length > DENSE_VISIBLE;
  const visible = capped ? sorted.slice(0, DENSE_VISIBLE) : sorted;
  const hidden = sorted.length - visible.length;

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
        {visible.map((miner) => (
          <MinerCard
            key={miner.threadid}
            miner={miner}
            peak={peak}
            density={density}
            history={history.get(miner.threadid)}
          />
        ))}
      </div>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-3 w-full rounded-lg border border-rule bg-paper-card py-2 text-sm font-medium text-ink-2 transition hover:border-accent hover:text-ink"
        >
          Show all {summary.count} rigs ({hidden} slower {hidden === 1 ? 'rig' : 'rigs'} hidden)
        </button>
      )}
    </Section>
  );
}
