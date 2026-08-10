import type { Statistics } from '../api/schema';

/*
  Venue prices out of /statistics.

  Read by pattern rather than from a fixed list. The server publishes one key per
  venue as "Duco <Venue> price" (plus "Duco price <TICKER>" for a few chains), and
  that set changes over time — "Duco Bitstorage price" appeared after 2024, and
  SushiSwap/TRX/XMG have since gone to zero. A hardcoded list would quietly miss
  new venues and keep advertising dead ones.
*/

/** Normalise "Duco PancakeSwap price" -> "pancake", matching the /v2/users keys. */
function slugify(venue: string): string {
  const key = venue.toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases: Record<string, string> = {
    pancakeswap: 'pancake',
    sushiswap: 'sushi',
    fluffyswap: 'fluffy',
    nodes: 'nodes',
    'node-s': 'nodes',
  };
  return aliases[key] ?? key;
}

/**
 * Extract every venue price the server knows about.
 *
 * Zero is preserved rather than dropped: a dead market is information the dashboard
 * shows explicitly, and silently omitting it would make the venue look merely
 * missing.
 */
export function readVenuePrices(stats: Statistics): Record<string, number> {
  const out: Record<string, number> = {};

  for (const [key, value] of Object.entries(stats)) {
    if (typeof value !== 'number') continue;

    // "Duco PancakeSwap price" / "Duco Bitstorage price"
    const venue = /^Duco\s+(.+?)\s+price$/i.exec(key);
    if (venue?.[1]) {
      out[slugify(venue[1])] = value;
      continue;
    }
    // "Duco price TRX" / "Duco price NANO"
    const ticker = /^Duco\s+price\s+([A-Z]+)$/.exec(key);
    if (ticker?.[1]) out[slugify(ticker[1])] = value;
  }

  return out;
}

/** The headline reference price. Never used as the hero figure. */
export function nominalPrice(stats: Statistics): number {
  return typeof stats['Duco price'] === 'number' ? stats['Duco price'] : 0;
}
