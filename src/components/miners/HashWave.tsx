import { useEffect, useRef, useState } from 'react';

/**
 * A running waveform for one rig.
 *
 * The API reports an instantaneous hashrate and a share time, with no waveform of
 * any kind — this is an *expressive* encoding of those two numbers, not measured
 * data, so it never carries an axis or a value label: amplitude scales with the
 * rig's hashrate relative to the fleet's fastest, and the wave travels at a rate
 * set by its share time. A fast rig visibly runs faster than a slow one.
 *
 * The measured series is the sparkline drawn behind it, which *is* real sampled
 * data (see `useHashrateHistory`).
 */
export function HashWave({
  hashrate,
  peak,
  sharetime,
  history,
  width = 132,
  height = 34,
}: {
  hashrate: number;
  peak: number;
  sharetime: number;
  history?: number[];
  width?: number;
  height?: number;
}) {
  const [phase, setPhase] = useState(0);
  const frame = useRef(0);
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Faster share time -> faster travel. Clamped so a 0.4s PC miner doesn't strobe.
  const speed = Math.min(2.4, Math.max(0.35, 1.6 / Math.max(0.3, sharetime)));

  useEffect(() => {
    if (reduced) return undefined;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = (now - last) / 1000;
      last = now;
      setPhase((p) => (p + delta * speed) % (Math.PI * 2));
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [speed, reduced]);

  /*
    Relative loudness on a log scale: rigs span four orders of magnitude (a 268 H/s
    Uno beside a 1.3 MH/s desktop), so a linear amplitude flattens every
    microcontroller to a straight line.

    Log alone over-compresses in the other direction though — it puts that Uno at
    0.40 of the desktop's amplitude, which looks nearly the same on a 40px-tall
    wave. The exponent stretches the spread back out so the difference is legible,
    and the floor keeps the smallest rig from flatlining entirely.
  */
  const relative =
    peak > 0 && hashrate > 0
      ? Math.min(1, Math.max(0.1, (Math.log10(1 + hashrate) / Math.log10(1 + peak)) ** 2.2))
      : 0.1;

  const mid = height / 2;
  const amplitude = (height / 2 - 2) * relative;
  const points: string[] = [];
  const steps = 44;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const t = (i / steps) * Math.PI * 4 + phase;
    // Two summed harmonics keep it from looking like a pure sine.
    const y = mid - (Math.sin(t) * 0.72 + Math.sin(t * 2.3) * 0.28) * amplitude;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  const spark = sparkPath(history ?? [], width, height);

  /*
    Stretches to whatever width the card gives it. `preserveAspectRatio="none"`
    scales x and y independently, which would normally smear the stroke — hence
    `vectorEffect="non-scaling-stroke"`, so the line keeps its weight at any width.
  */
  return (
    <svg
      className="w-full"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {spark && (
        <path
          d={spark}
          fill="none"
          stroke="var(--color-baseline)"
          strokeWidth={1}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        opacity={0.9}
      />
    </svg>
  );
}

/** Sampled hashrate history, normalised to the panel. */
function sparkPath(series: number[], width: number, height: number): string | null {
  if (series.length < 3) return null;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  return series
    .map((value, i) => {
      const x = (i / (series.length - 1)) * width;
      const y = height - 2 - ((value - min) / span) * (height - 4);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
