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
/*
  Matches the ways a Pi identifies itself. Note the absence of a trailing \b on
  "rpi": a word boundary there fails on "rpi4", and "raspberry" needs to match as a
  plain substring because the stock hostname is "raspberrypi", where \b never fires
  between the "y" and the "pi".
*/
const PI_PATTERN = /raspberry|raspi|\brpi|\bpi[-_ ]?\d/i;

const RULES: [RegExp, MinerKind][] = [
  [/\brpi|raspberry|raspi|^rp\s/i, 'RPi'],
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
      if (kind === 'CPU' && PI_PATTERN.test(identifier)) return 'RPi';
      return kind;
    }
  }
  for (const [pattern, kind] of RULES) {
    if (identifier && pattern.test(identifier)) return kind;
  }
  return 'Other';
}

/**
 * One physical machine, which may be several worker threads.
 *
 * The API's unit is a *thread*, not a device: a dual-core ESP32 running the
 * official miner opens one connection per core, so a four-board fleet comes back as
 * eight rows with the same `identifier` and pool. Reporting those as eight rigs
 * double-counts the hardware and contradicts what the owner sees on their desk.
 */
export type Rig = {
  /** Grouping key: the rig name, or the thread id when unnamed. */
  id: string;
  name: string;
  kind: MinerKind;
  software: string;
  /** Number of worker threads this device is running. */
  threads: number;
  threadIds: string[];
  /** Summed across threads — the device's real output. */
  hashrate: number;
  accepted: number;
  rejected: number;
  /** Mean across threads; per-thread share times differ. */
  sharetime: number;
  diff: number;
  pool?: string;
};

/**
 * Collapse worker threads into devices.
 *
 * Grouped by `identifier`, which is the name the owner set on the miner. Rigs with
 * no name ("None") can't be told apart this way, so each of those threads stays its
 * own entry rather than being merged into one bogus mega-rig.
 */
export function groupIntoRigs(miners: Miner[]): Rig[] {
  const groups = new Map<string, Miner[]>();

  for (const miner of miners) {
    const named = miner.identifier && miner.identifier !== 'None';
    const key = named ? `name:${miner.identifier}` : `thread:${miner.threadid}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(miner);
    else groups.set(key, [miner]);
  }

  return [...groups.entries()].map(([id, threads]) => {
    const first = threads[0]!;
    const named = first.identifier && first.identifier !== 'None';
    return {
      id,
      name: named ? first.identifier : classifyMiner(first),
      kind: classifyMiner(first),
      software: first.software,
      threads: threads.length,
      threadIds: threads.map((t) => t.threadid),
      hashrate: threads.reduce((sum, t) => sum + t.hashrate, 0),
      accepted: threads.reduce((sum, t) => sum + t.accepted, 0),
      rejected: threads.reduce((sum, t) => sum + t.rejected, 0),
      sharetime: threads.reduce((sum, t) => sum + t.sharetime, 0) / threads.length,
      diff: first.diff,
      pool: first.pool,
    };
  });
}

export type FleetSummary = {
  /** Physical devices. */
  count: number;
  /** Worker threads across those devices; higher when rigs are multi-core. */
  threads: number;
  hashrate: number;
  accepted: number;
  rejected: number;
  acceptRate: number;
  byKind: { kind: MinerKind; count: number; hashrate: number }[];
  pools: string[];
};

export function summariseFleet(rigs: Rig[]): FleetSummary {
  const byKind = new Map<MinerKind, { count: number; hashrate: number }>();
  const pools = new Set<string>();
  let hashrate = 0;
  let accepted = 0;
  let rejected = 0;
  let threads = 0;

  for (const rig of rigs) {
    const entry = byKind.get(rig.kind) ?? { count: 0, hashrate: 0 };
    entry.count += 1;
    entry.hashrate += rig.hashrate;
    byKind.set(rig.kind, entry);

    hashrate += rig.hashrate;
    accepted += rig.accepted;
    rejected += rig.rejected;
    threads += rig.threads;
    if (rig.pool) pools.add(rig.pool);
  }

  const shares = accepted + rejected;
  return {
    count: rigs.length,
    threads,
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
