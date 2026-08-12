/**
 * A rig's hashrate over time — measured, not illustrated.
 *
 * This deliberately draws nothing until there is something real to draw. An earlier
 * version animated a sine wave whose amplitude and speed were derived from the
 * rig's hashrate and share time. It looked like a data trace and wasn't one, which
 * is exactly the kind of decorative fiction this dashboard exists to argue against.
 *
 * The series is sampled client-side while the page is open (the API reports only an
 * instantaneous rate and keeps no per-rig history), so it starts empty and fills in
 * as polls come back.
 */
export function HashWave({
  history,
  width = 132,
  height = 34,
}: {
  history?: number[];
  width?: number;
  height?: number;
}) {
  const series = history ?? [];

  // Two points is a line between two guesses, not a trend. Hold until there's shape.
  if (series.length < 3) {
    return (
      <svg
        className="w-full"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Not enough samples yet to show a hashrate trend"
      >
        <title>Sampling — a trend appears after a few refreshes</title>
        <line
          x1={0}
          x2={width}
          y1={height / 2}
          y2={height / 2}
          stroke="var(--color-rule)"
          strokeWidth={1}
          strokeDasharray="3 4"
          vectorEffect="non-scaling-stroke"
        />
        {/* Say why it's empty. An unexplained dashed line reads as a broken chart. */}
        {height >= 26 && (
          <text
            x={width / 2}
            y={height / 2 - 5}
            textAnchor="middle"
            fontSize={9}
            fill="var(--color-ink-muted)"
          >
            sampling…
          </text>
        )}
      </svg>
    );
  }

  const min = Math.min(...series);
  const max = Math.max(...series);
  const mean = series.reduce((a, b) => a + b, 0) / series.length;

  /*
    Normalise against a floor of ±5% around the mean rather than the raw min/max.
    Self-normalising to the observed range would blow a rig holding steady between
    80.9 and 81.2 kH/s up into a dramatic mountain range — technically the data,
    but a wildly misleading picture of a rig that is in fact rock stable.
  */
  const band = Math.max(max - min, Math.abs(mean) * 0.05, 1e-9);
  const mid = (max + min) / 2;
  const lo = mid - band / 2;

  const points = series.map((value, i) => {
    const x = (i / (series.length - 1)) * width;
    const y = height - 2 - ((value - lo) / band) * (height - 4);
    return `${x.toFixed(1)},${Math.max(2, Math.min(height - 2, y)).toFixed(1)}`;
  });

  const last = series[series.length - 1]!;

  return (
    <svg
      className="w-full"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Hashrate across the last ${series.length} samples`}
    >
      <title>{`${series.length} samples · low ${min.toFixed(0)} · high ${max.toFixed(0)} H/s`}</title>
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* End marker, so the current sample is locatable on a busy line. */}
      <circle
        cx={width}
        cy={Math.max(2, Math.min(height - 2, height - 2 - ((last - lo) / band) * (height - 4)))}
        r={2}
        fill="var(--color-accent)"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
