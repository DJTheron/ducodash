import type { Miner } from '../api/schema';

/*
  Rig taxonomy.

  These nine buckets are not invented — they're the exact keys the server publishes
  under "Miner distribution" in /statistics, so a fleet breakdown here lines up with
  the network-wide numbers shown elsewhere on the page.

  The rules below were written against the 90 distinct `software` strings actually
  present on the network (sampled from /miners), not from guesswork.
*/
export const MINER_KINDS = [
  'ESP32',
  'ESP8266',
  'Arduino',
  'RPi',
  'CPU',
  'GPU',
  'Phone',
  'Web',
  'Other',
] as const;

export type MinerKind = (typeof MINER_KINDS)[number];

/**
 * Families group the nine kinds into four visual tints. Type identity is carried by
 * the glyph and the label; the tint is only a secondary cue, which keeps us clear of
 * needing nine distinguishable hues (a palette that size can't pass CVD checks).
 */
export const KIND_FAMILY: Record<MinerKind, 'micro' | 'computer' | 'mobile' | 'other'> = {
  ESP32: 'micro',
  ESP8266: 'micro',
  Arduino: 'micro',
  RPi: 'computer',
  CPU: 'computer',
  GPU: 'computer',
  Phone: 'mobile',
  Web: 'mobile',
  Other: 'other',
};

/*
  Order matters. "RPI I2C AVR Miner 4.3" contains both "RPI" and "AVR", and
  "Official DUCOCUBE Miner (ESP32)" only reveals itself via the parenthetical, so the
  more specific patterns have to be tested first.
*/
const RULES: [RegExp, MinerKind][] = [
  [/\b(rpi|raspberry|^rp\s)/i, 'RPi'],
  [/esp32|esp-32|ducocube|blushybox/i, 'ESP32'],
  [/esp8266|esp-8266|nodemcu|wemos/i, 'ESP8266'],
  [/avr|arduino|atmega|nano|uno|i2c|hobi-one/i, 'Arduino'],
  [/gpu|opencl|cuda|nvidia|amd/i, 'GPU'],
  [/android|ios|iphone|phone|mobile/i, 'Phone'],
  [/web\s*miner|webminer|browser/i, 'Web'],
  [/pc\s*miner|cpu|desktop|python/i, 'CPU'],
];

/**
 * Classify a rig from its reported software, falling back to the user-set rig name.
 *
 * Known imprecision: the official PC miner running on a Raspberry Pi reports itself
 * as "Official PC Miner", so it lands in CPU unless the rig name says otherwise. The
 * server has host-side signals we don't get over the API, which is why its RPi count
 * runs higher than ours. Checking the identifier recovers most of the difference.
 */
export function classifyMiner(miner: Pick<Miner, 'software' | 'identifier'>): MinerKind {
  const software = miner.software ?? '';
  const identifier = miner.identifier && miner.identifier !== 'None' ? miner.identifier : '';

  for (const [pattern, kind] of RULES) {
    if (pattern.test(software)) {
      // A rig named "raspberrypi-4" running the PC miner is really a Pi.
      if (kind === 'CPU' && /\b(rpi|raspberry|pi\d?)\b/i.test(identifier)) return 'RPi';
      return kind;
    }
  }
  for (const [pattern, kind] of RULES) {
    if (identifier && pattern.test(identifier)) return kind;
  }
  return 'Other';
}

export type FleetSummary = {
  count: number;
  hashrate: number;
  accepted: number;
  rejected: number;
  acceptRate: number;
  byKind: { kind: MinerKind; count: number; hashrate: number }[];
  pools: string[];
};

export function summariseFleet(miners: Miner[]): FleetSummary {
  const byKind = new Map<MinerKind, { count: number; hashrate: number }>();
  const pools = new Set<string>();
  let hashrate = 0;
  let accepted = 0;
  let rejected = 0;

  for (const miner of miners) {
    const kind = classifyMiner(miner);
    const entry = byKind.get(kind) ?? { count: 0, hashrate: 0 };
    entry.count += 1;
    entry.hashrate += miner.hashrate;
    byKind.set(kind, entry);

    hashrate += miner.hashrate;
    accepted += miner.accepted;
    rejected += miner.rejected;
    if (miner.pool) pools.add(miner.pool);
  }

  const shares = accepted + rejected;
  return {
    count: miners.length,
    hashrate,
    accepted,
    rejected,
    acceptRate: shares > 0 ? accepted / shares : 1,
    // Sorted by hashrate so the fleet's real workhorses lead.
    byKind: [...byKind.entries()]
      .map(([kind, v]) => ({ kind, ...v }))
      .sort((a, b) => b.hashrate - a.hashrate),
    pools: [...pools].sort(),
  };
}

/**
 * Card density.
 *
 * A handful of rigs should feel like a showcase, not lost in whitespace; a hundred
 * rigs have to stay on one screen. The tier drives card size, which visualisers are
 * drawn, and how much metadata each card carries.
 */
export type Density = 'showcase' | 'compact' | 'dense';

export function densityFor(count: number): Density {
  if (count <= 6) return 'showcase';
  if (count <= 24) return 'compact';
  return 'dense';
}
