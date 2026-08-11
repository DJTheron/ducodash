import { formatCompact } from '../../lib/format';

/**
 * Accepted-versus-rejected shares as a ring.
 *
 * A rig's lifetime work is one number that only matters relative to its failures,
 * so the ring carries the count and the gap in the ring carries the reject rate.
 * The unfilled track is a lighter step of the same ramp rather than a second hue,
 * so the state reads across the whole arc.
 */
export function ShareArc({
  accepted,
  rejected,
  size = 74,
  label = true,
}: {
  accepted: number;
  rejected: number;
  size?: number;
  label?: boolean;
}) {
  const total = accepted + rejected;
  const rate = total > 0 ? accepted / total : 1;

  const strokeWidth = Math.max(3, size * 0.075);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Leave a gap at the bottom so the ring reads as a gauge rather than a pie.
  const sweep = 0.78;
  const track = circumference * sweep;
  const filled = track * rate;

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <g transform={`rotate(${90 + (1 - sweep) * 180} ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-accent-soft)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${track} ${circumference}`}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            style={{ transition: 'stroke-dasharray 900ms cubic-bezier(0.22,1,0.36,1)' }}
          />
        </g>
      </svg>

      {label && (
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          <span
            className="tnum font-display text-ink"
            style={{ fontSize: size * 0.26 }}
          >
            {formatCompact(accepted)}
          </span>
          {/*
            A count, not a percentage. A rig with 12 rejects out of 48,000 renders as
            "0.0% rej", which reads as "none" while sitting next to rigs labelled
            "shares" that genuinely have none — the count never makes that mistake.
          */}
          <span className="mt-0.5 text-ink-muted" style={{ fontSize: Math.max(8, size * 0.115) }}>
            {rejected > 0 ? `${formatCompact(rejected)} rej` : 'shares'}
          </span>
        </div>
      )}
    </div>
  );
}
