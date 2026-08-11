import { MIN_WRAP_DUCO, quoteBscVenues, quoteReportedVenues, quoteSunSwap } from './venues';
import type { ExchangeReport, VenueQuote } from './types';

/** Money a venue would actually hand over: net of costs where we modelled them. */
export function realisedValue(quote: VenueQuote): number {
  return quote.netUsd ?? quote.grossUsd;
}

/**
 * Build the full picture for a holding.
 *
 * Ranking rule, and the reason the whole module exists: the headline is only ever
 * taken from a venue whose depth we actually simulated. A centralised venue can
 * advertise a better price than any pool, but we cannot verify it will fill, so it
 * never becomes the hero number — it surfaces as a caveat instead.
 */
export async function buildExchangeReport(
  amount: number,
  serverPrices: Record<string, number>,
  nominalUsd: number,
  signal?: AbortSignal,
): Promise<ExchangeReport> {
  const errors: string[] = [];
  const quotes: VenueQuote[] = [];

  const [bsc, sun] = await Promise.allSettled([
    quoteBscVenues(amount, signal),
    quoteSunSwap(amount, signal),
  ]);

  if (bsc.status === 'fulfilled') quotes.push(...bsc.value);
  else errors.push(`PancakeSwap depth unavailable: ${describe(bsc.reason)}`);

  if (sun.status === 'fulfilled') {
    if (sun.value) quotes.push(sun.value);
  } else {
    errors.push(`SunSwap depth unavailable: ${describe(sun.reason)}`);
  }

  // Anything we modelled directly must not also appear as a second-hand quote.
  const modelled = new Set<string>();
  if (bsc.status === 'fulfilled' && bsc.value.length > 0) modelled.add('pancake');
  if (sun.status === 'fulfilled' && sun.value?.status === 'ok') modelled.add('sunswap');
  quotes.push(...quoteReportedVenues(serverPrices, amount, modelled));

  /*
    Filter on gross, not net. A venue whose fees exceed the proceeds still has a
    live market and is still the best available route — "the only way out costs
    more than it returns" is the answer, and dropping the venue would instead
    promote an unverifiable quote into the headline.
  */
  const tradeable = quotes.filter((q) => q.status === 'ok' && q.grossUsd > 0);
  const realisable = tradeable.filter((q) => q.provenance === 'realisable');
  const pool = realisable.length > 0 ? realisable : tradeable;

  let best =
    pool.length > 0
      ? pool.reduce((a, b) => (realisedValue(b) > realisedValue(a) ? b : a))
      : null;

  /*
    Below the bridge minimum every on-chain route is unreachable, however good the
    pool looks. Saying so is more useful than quoting a price the user cannot get.
  */
  if (best && amount < MIN_WRAP_DUCO && best.venue.kind === 'dex') {
    best = {
      ...best,
      status: 'unavailable',
      note: `Below the ${MIN_WRAP_DUCO} DUCO minimum to wrap — no on-chain route available yet`,
    };
  }

  quotes.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'ok' ? -1 : 1;
    return realisedValue(b) - realisedValue(a);
  });

  return {
    best,
    quotes,
    nominalUsd,
    nominalTotalUsd: nominalUsd * amount,
    at: Date.now(),
    errors,
  };
}

/**
 * A venue quoting above the best verifiable route. Not promoted to the headline —
 * we can't confirm it fills — but worth telling the user about.
 */
export function betterUnverifiedQuote(report: ExchangeReport): VenueQuote | null {
  if (!report.best || report.best.provenance !== 'realisable') return null;
  const target = realisedValue(report.best);
  const candidates = report.quotes.filter(
    (q) => q.status === 'ok' && q.provenance === 'quoted' && q.grossUsd > target,
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (b.grossUsd > a.grossUsd ? b : a));
}

function describe(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  return String(reason);
}
