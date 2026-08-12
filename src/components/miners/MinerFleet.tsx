import { useMemo, useState } from 'react';
import { formatCompact, formatDuco, formatHashrate, formatPercent } from '../../lib/format';
import { densityFor, summariseFleet, type Density, type Rig } from '../../miners/classify';
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
  rig,
  density,
  history,
}: {
  rig: Rig;
  density: Density;
  history?: number[];
}) {
  const tier = TIER[density];
  const { kind, name } = rig;
  const dense = density === 'dense';
  const shares = rig.accepted + rig.rejected;
  const rejectRate = shares > 0 ? rig.rejected / shares : 0;

  return (
    <article
      className={`card ${tier.padding} flex flex-col gap-2 transition hover:border-accent/50`}
      title={`${rig.software} · ${formatHashrate(rig.hashrate)} across ${rig.threads} ${rig.threads === 1 ? 'thread' : 'threads'} · ${formatCompact(rig.accepted)} shares · difficulty ${formatCompact(rig.diff)}${rig.pool ? ` · ${rig.pool}` : ''}`}
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
            {/*
              A multi-core rig reports one worker per core. Showing the thread count
              explains why its hashrate is a multiple of a single thread's, instead
              of leaving the owner to wonder why they appear to own twice the
              hardware they do.
            */}
            {rig.threads > 1 && (
              <span
                className="shrink-0 rounded bg-paper-sunk px-1 text-[10px] font-semibold text-ink-2"
                title={`${rig.threads} worker threads on this device`}
              >
                ×{rig.threads}
              </span>
            )}
          </div>
          {!dense && (
            <p className="mt-0.5 truncate text-xs text-ink-muted" title={rig.software}>
              {rig.software}
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
        {!dense && <ShareArc accepted={rig.accepted} rejected={rig.rejected} size={tier.arc} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span
              className={`tnum font-display text-ink ${dense ? 'text-sm' : 'text-xl'}`}
              title={
                rig.threads > 1
                  ? `Combined across ${rig.threads} threads`
                  : 'Current hashrate'
              }
            >
              {formatHashrate(rig.hashrate)}
            </span>
            {dense && rejectRate > REJECT_ALERT && (
              <span
                className="text-[10px] font-semibold text-critical"
                title={`${formatCompact(rig.rejected)} rejected of ${formatCompact(shares)} shares`}
              >
                ▲ {formatPercent(rejectRate, 0)}
              </span>
            )}
          </div>
          <HashWave history={history} width={tier.wave.width} height={tier.wave.height} />
        </div>
      </div>

      {density === 'showcase' && (
        <dl className="mt-1 grid grid-cols-3 gap-2 border-t border-rule pt-2.5 text-xs">
          <div>
            <dt className="text-ink-muted">Difficulty</dt>
            <dd className="tnum mt-0.5 text-ink-2">{formatCompact(rig.diff)}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Share time</dt>
            <dd className="tnum mt-0.5 text-ink-2">{rig.sharetime.toFixed(2)}s</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Rejected</dt>
            <dd className="tnum mt-0.5 text-ink-2">{formatCompact(rig.rejected)}</dd>
          </div>
        </dl>
      )}
    </article>
  );
}

export function MinerFleet({
  rigs,
  history,
}: {
  rigs: Rig[];
  history: Map<string, number[]>;
}) {
  const summary = useMemo(() => summariseFleet(rigs), [rigs]);
  const density = densityFor(rigs.length);
  const tier = TIER[density];

  const sorted = useMemo(() => [...rigs].sort((a, b) => b.hashrate - a.hashrate), [rigs]);

  const [expanded, setExpanded] = useState(false);
  const capped = density === 'dense' && !expanded && sorted.length > DENSE_VISIBLE;
  const visible = capped ? sorted.slice(0, DENSE_VISIBLE) : sorted;
  const hidden = sorted.length - visible.length;

  if (rigs.length === 0) {
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
      subtitle={
        `${summary.count} ${summary.count === 1 ? 'rig' : 'rigs'}` +
        // Only worth saying when they differ; on single-threaded fleets it's noise.
        (summary.threads > summary.count ? ` · ${summary.threads} worker threads` : '') +
        ` · ${formatHashrate(summary.hashrate)} · ${formatDuco(summary.accepted, 0)} shares accepted`
      }
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
        {visible.map((rig) => (
          <MinerCard
            key={rig.id}
            rig={rig}
            density={density}
            history={history.get(rig.id)}
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
