/** Formatting helpers. Pure, so they're cheap to unit-test and safe to reuse. */

/** DUCO amount with thousands separators. Precision shrinks as magnitude grows. */
export function formatDuco(value: number, maxDecimals?: number): string {
  const abs = Math.abs(value);
  const decimals = maxDecimals ?? (abs >= 100_000 ? 0 : abs >= 100 ? 2 : abs >= 1 ? 3 : 6);
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * USD, honestly.
 *
 * DUCO trades around $0.00007, so a naive 2-decimal format renders almost every
 * real holding as "$0.00" — the exact false-precision this dashboard exists to
 * avoid. Small values keep enough significant digits to stay meaningful.
 */
export function formatUsd(value: number): string {
  const abs = Math.abs(value);
  if (abs === 0) return '$0.00';
  if (abs < 0.01) {
    const decimals = Math.min(8, Math.max(4, Math.ceil(-Math.log10(abs)) + 2));
    return `$${value.toFixed(decimals)}`;
  }
  if (abs < 1000) return `$${value.toFixed(2)}`;
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

/** Price per single DUCO — always needs more precision than a total. */
export function formatUnitPrice(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  return `$${value.toPrecision(3)}`;
}

export function formatCompact(value: number): string {
  return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

/** Hashrate in H/s scaled to the natural unit. */
export function formatHashrate(hs: number): string {
  if (!Number.isFinite(hs) || hs <= 0) return '0 H/s';
  const units = ['H/s', 'kH/s', 'MH/s', 'GH/s', 'TH/s'];
  const i = Math.min(units.length - 1, Math.floor(Math.log10(hs) / 3));
  const scaled = hs / 1000 ** i;
  return `${scaled.toFixed(scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2)} ${units[i]}`;
}

export function formatPercent(fraction: number, decimals = 1): string {
  return `${(fraction * 100).toFixed(decimals)}%`;
}

/**
 * Duino-Coin serves `DD/MM/YYYY HH:MM:SS` (UTC), which `new Date()` misreads as
 * US month-first — silently turning 03/10 into 10 March. Parsed explicitly.
 */
export function parseDucoDate(value: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/.exec(value.trim());
  if (!m) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const [, dd, mm, yyyy, hh = '0', mi = '0', ss = '0'] = m;
  const date = new Date(
    Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss)),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatRelative(date: Date | null, now = Date.now()): string {
  if (!date) return '—';
  const seconds = Math.round((now - date.getTime()) / 1000);
  const table: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [3600, 'minute'],
    [86400, 'hour'],
    [2592000, 'day'],
    [31536000, 'month'],
    [Infinity, 'year'],
  ];
  const divisors = [1, 60, 3600, 86400, 2592000, 31536000];
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  for (let i = 0; i < table.length; i++) {
    const limit = table[i]![0];
    if (Math.abs(seconds) < limit) {
      return rtf.format(-Math.round(seconds / divisors[i]!), table[i]![1]);
    }
  }
  return '—';
}

/** "2.076 GH/s" -> 2076000000. The network stats endpoint reports pre-formatted. */
export function parseHashrateString(value: string): number {
  const m = /^([\d.]+)\s*([kMGTP]?)H\/s$/i.exec(value.trim());
  if (!m) return 0;
  const scale: Record<string, number> = { '': 1, k: 1e3, M: 1e6, G: 1e9, T: 1e12, P: 1e15 };
  return Number(m[1]) * (scale[m[2] ?? ''] ?? 1);
}
