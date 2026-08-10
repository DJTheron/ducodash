import { useMemo, useRef, useState } from 'react';

export type Point = { t: number; value: number };

/*
  A single-series time chart.

  Hand-rolled SVG rather than a chart library: it inherits the paper theme's tokens
  directly, adds nothing to the bundle, and gives exact control over the two things
  that actually matter here — gap handling and the hover layer.

  Single series, so no legend box: the section heading names what's plotted.
*/
export function LineChart({
  points,
  height = 190,
  format,
  formatX,
  label,
  emphasiseLast = true,
}: {
  points: Point[];
  height?: number;
  format: (value: number) => string;
  formatX?: (t: number) => string;
  label: string;
  emphasiseLast?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const width = 720;

  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const values = points.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    // A flat series would otherwise divide by zero and collapse onto the axis.
    const span = max - min || Math.abs(max) || 1;
    const lo = min - span * 0.12;
    const hi = max + span * 0.12;

    /*
      Reserve the gutter from the widest tick label rather than a fixed value.
      DUCO prices format to ten characters ("$0.0000719") and were being clipped by
      a gutter sized for a four-digit balance.
    */
    const ticks = [0.15, 0.5, 0.85].map((f) => format(lo + (hi - lo) * f));
    const widest = Math.max(...ticks.map((t) => t.length));
    const pad = { top: 14, right: Math.max(46, widest * 6.4 + 14), bottom: 22, left: 8 };

    const times = points.map((p) => p.t);
    const t0 = Math.min(...times);
    const t1 = Math.max(...times);
    const tSpan = t1 - t0 || 1;

    const x = (t: number) => pad.left + ((t - t0) / tSpan) * (width - pad.left - pad.right);
    const y = (v: number) =>
      pad.top + (1 - (v - lo) / (hi - lo)) * (height - pad.top - pad.bottom);

    return { x, y, lo, hi, pad };
  }, [points, height, format]);

  if (!geometry) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-ink-muted">
        Not enough data to chart yet.
      </div>
    );
  }

  const { x, y, lo, hi, pad } = geometry;
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t)},${y(p.value)}`).join(' ');
  const area =
    `M${x(points[0]!.t)},${height - pad.bottom} ` +
    points.map((p) => `L${x(p.t)},${y(p.value)}`).join(' ') +
    ` L${x(points[points.length - 1]!.t)},${height - pad.bottom} Z`;

  const last = points[points.length - 1]!;
  const gridValues = [lo + (hi - lo) * 0.15, lo + (hi - lo) * 0.5, lo + (hi - lo) * 0.85];

  const active = hover === null ? null : points[hover];

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    // Map pointer position into the viewBox's own coordinate space.
    const localX = ((event.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < points.length; i++) {
      const distance = Math.abs(x(points[i]!.t) - localX);
      if (distance < best) {
        best = distance;
        nearest = i;
      }
    }
    setHover(nearest);
  };

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full touch-none"
        style={{ height }}
        role="img"
        aria-label={label}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {gridValues.map((v) => (
          <g key={v}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--color-rule)"
              strokeWidth={1}
            />
            <text
              x={width - pad.right + 8}
              y={y(v) + 4}
              className="tnum"
              fontSize={11}
              fill="var(--color-ink-muted)"
            >
              {format(v)}
            </text>
          </g>
        ))}

        <path d={area} fill="var(--color-accent)" opacity={0.1} />
        <path
          d={line}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {emphasiseLast && (
          <circle
            cx={x(last.t)}
            cy={y(last.value)}
            r={4}
            fill="var(--color-accent)"
            stroke="var(--color-paper-card)"
            strokeWidth={2}
          />
        )}

        {active && (
          <g>
            <line
              x1={x(active.t)}
              x2={x(active.t)}
              y1={pad.top}
              y2={height - pad.bottom}
              stroke="var(--color-baseline)"
              strokeWidth={1}
            />
            <circle
              cx={x(active.t)}
              cy={y(active.value)}
              r={4.5}
              fill="var(--color-accent)"
              stroke="var(--color-paper-card)"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-md border border-rule bg-paper-card px-2 py-1 text-xs shadow-sm"
          style={{ left: `${(x(active.t) / width) * 100}%` }}
        >
          <div className="tnum font-medium text-ink">{format(active.value)}</div>
          {formatX && <div className="text-ink-muted">{formatX(active.t)}</div>}
        </div>
      )}
    </div>
  );
}
