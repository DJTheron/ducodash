import { formatDuco } from '../../lib/format';
import { Odometer, useIncreasePulse } from './Odometer';

/**
 * The soft radial wash behind the balance.
 *
 * Two offset blurred ellipses in the accent hue, drifting very slowly against each
 * other. This is what stops a huge number on a flat cream field looking like
 * unstyled text — and it brightens for a moment whenever the balance ticks up, so
 * mining income is felt rather than just displayed.
 */
function InkBloom({ active }: { active: boolean }) {
  return (
    <svg
      className="pointer-events-none absolute left-1/2 top-[58%] -z-10 h-[115%] w-[92%] max-w-4xl -translate-x-1/2 -translate-y-1/2"
      viewBox="0 0 400 160"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="bloom-warm">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={active ? 0.26 : 0.15} />
          <stop offset="65%" stopColor="var(--color-accent)" stopOpacity={active ? 0.07 : 0.04} />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bloom-cool">
          <stop offset="0%" stopColor="#d9a441" stopOpacity={active ? 0.18 : 0.1} />
          <stop offset="100%" stopColor="#d9a441" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="185" cy="80" rx="140" ry="52" fill="url(#bloom-warm)">
        <animate attributeName="cx" values="185;220;185" dur="21s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="225" cy="86" rx="115" ry="44" fill="url(#bloom-cool)">
        <animate attributeName="cx" values="225;190;225" dur="27s" repeatCount="indefinite" />
      </ellipse>
    </svg>
  );
}

type Props = {
  username: string;
  balance: number;
  verified: boolean;
  stale: boolean;
};

export function BalanceHero({ username, balance, verified, stale }: Props) {
  const pulsing = useIncreasePulse(balance);
  const [whole = '0', fraction] = formatDuco(balance, balance >= 100_000 ? 2 : 3).split('.');

  return (
    <header className="relative flex flex-col items-center px-4 pb-2 pt-14 text-center sm:pt-20">
      <InkBloom active={pulsing} />

      <div className="flex items-center gap-2">
        <span className="eyebrow">{username}</span>
        {verified && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink"
            title="Verified account"
          >
            <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
              <path
                d="M6.5 10.6 4.2 8.3l-1 1 3.3 3.3 6.3-6.3-1-1z"
                fill="currentColor"
              />
            </svg>
            Verified
          </span>
        )}
      </div>

      {/*
        Deliberately not `background-clip: text`: the odometer's digit strips are
        absolutely positioned, so they fall outside the wrapper's background box and
        a clipped gradient renders them invisible. Solid ink, and the bloom behind
        carries the warmth instead.
      */}
      <h1
        className="relative mt-2 flex items-baseline justify-center font-display leading-none tracking-[-0.015em] text-ink"
        style={{ fontSize: 'clamp(3.2rem, 13vw, 9.5rem)' }}
      >
        <Odometer value={whole} />
        {fraction !== undefined && (
          <span className="text-ink-muted" style={{ fontSize: '0.36em' }}>
            .<Odometer value={fraction} />
          </span>
        )}
        <span
          className="ml-[0.5em] font-sans text-ink-muted"
          style={{ fontSize: '0.115em', letterSpacing: '0.1em' }}
          title="Duino-Coin"
        >
          DUCO
        </span>
      </h1>

      {stale && (
        <p className="mt-2 text-xs text-ink-muted">Showing the last known value — reconnecting…</p>
      )}
    </header>
  );
}
