import type { MinerKind } from '../../miners/classify';

/*
  A drawn mark per rig type.

  Duino-Coin's charm is that people mine it on £3 microcontrollers, so the fleet
  deserves to show what it's actually made of. Each glyph is a recognisable
  silhouette of the real hardware rather than an abstract icon, which is what lets a
  wall of rigs be read at a glance.

  Hand-drawn as inline SVG on a 24×24 grid: it inherits currentColor, scales to any
  card size without a second asset, and costs no network request.
*/

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const PATHS: Record<MinerKind, React.ReactNode> = {
  // Module with an RF shield can and the classic meander antenna.
  ESP32: (
    <>
      <rect x="4" y="6" width="16" height="13" rx="1.5" {...stroke} />
      <rect x="6.5" y="8.5" width="11" height="6.5" rx="0.8" {...stroke} />
      <path d="M7 6V4.4m3 1.6V4.4m3 1.6V4.4m3 1.6V4.4" {...stroke} />
      <path d="M6 17.2h12" {...stroke} strokeDasharray="1.2 1.6" />
    </>
  ),
  // Smaller board, single-sided castellations.
  ESP8266: (
    <>
      <rect x="5" y="7" width="14" height="11" rx="1.4" {...stroke} />
      <rect x="7" y="9.4" width="8" height="5.4" rx="0.8" {...stroke} />
      <path d="M16.6 9.4h1.6m-1.6 2.2h1.6m-1.6 2.2h1.6" {...stroke} />
      <path d="M7 18v1.6m3-1.6v1.6m3-1.6v1.6" {...stroke} />
    </>
  ),
  // Uno silhouette: notched board, header strips, USB tab.
  Arduino: (
    <>
      <path d="M4.5 7h13a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 15.5v-7A1.5 1.5 0 0 1 4.5 7Z" {...stroke} />
      <path d="M6 7V5.6h4V7" {...stroke} />
      <path d="M5.5 9.2h6M5.5 14.8h8" {...stroke} strokeDasharray="1 1.4" />
      <circle cx="15.5" cy="12" r="2" {...stroke} />
    </>
  ),
  // Pi: GPIO header along the top edge, SoC square, USB stack on the right.
  RPi: (
    <>
      <rect x="3.5" y="6" width="17" height="12" rx="1.5" {...stroke} />
      <path d="M6 8.4h9" {...stroke} strokeDasharray="1 1.3" />
      <rect x="7" y="11" width="4.5" height="4.5" rx="0.6" {...stroke} />
      <path d="M16 11h3.2M16 13.4h3.2M16 15.8h3.2" {...stroke} />
    </>
  ),
  // Die with legs on all four sides.
  CPU: (
    <>
      <rect x="6.5" y="6.5" width="11" height="11" rx="1.2" {...stroke} />
      <rect x="9.5" y="9.5" width="5" height="5" rx="0.6" {...stroke} />
      <path d="M9.5 6.5V4m5 2.5V4m-5 16v-2.5m5 2.5v-2.5M6.5 9.5H4m2.5 5H4m16-5h-2.5m2.5 5h-2.5" {...stroke} />
    </>
  ),
  // Expansion card with a fan.
  GPU: (
    <>
      <rect x="3" y="7" width="18" height="10" rx="1.4" {...stroke} />
      <circle cx="9" cy="12" r="3" {...stroke} />
      <path d="M9 9.6v4.8M6.9 10.8l4.2 2.4M6.9 13.2l4.2-2.4" {...stroke} />
      <path d="M15 10h4m-4 2.5h4m-4 2.5h2.5" {...stroke} />
    </>
  ),
  Phone: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2" {...stroke} />
      <path d="M10.5 5.4h3" {...stroke} />
      <circle cx="12" cy="18.2" r="0.9" {...stroke} />
    </>
  ),
  // Globe — the browser miner.
  Web: (
    <>
      <circle cx="12" cy="12" r="8.5" {...stroke} />
      <path d="M3.5 12h17" {...stroke} />
      <path d="M12 3.5c2.4 2.4 3.6 5.3 3.6 8.5s-1.2 6.1-3.6 8.5c-2.4-2.4-3.6-5.3-3.6-8.5S9.6 5.9 12 3.5Z" {...stroke} />
    </>
  ),
  Other: (
    <>
      <rect x="5" y="5" width="14" height="14" rx="2" {...stroke} />
      <path d="M9.8 10a2.2 2.2 0 1 1 2.9 2.1c-.5.2-.8.6-.8 1.1v.4" {...stroke} />
      <circle cx="12" cy="16.4" r="0.7" fill="currentColor" stroke="none" />
    </>
  ),
};

export function MinerGlyph({ kind, className }: { kind: MinerKind; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label={`${kind} miner`}>
      {PATHS[kind]}
    </svg>
  );
}
