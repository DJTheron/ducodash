import type { HistoricPrice, Miner, Statistics, Transaction, UserBundle } from '../api/schema';

/*
  Demo data.

  Field shapes, software strings, memos and network statistics are all copied from
  real responses captured from the live API on 2026-08-10 — so the demo exercises
  the same parsing and classification paths as production rather than an idealised
  version of them. The account itself is invented; no real user's balance is shown.

  Deliberately varied: nine rig types, every transaction category, a staking
  position and a truncated-looking history, so the whole UI can be reviewed offline.
*/

const RIGS: [string, string, number, number, number, number][] = [
  // software, rig name, hashrate H/s, sharetime s, accepted, rejected
  ['Official ESP32 Miner 4.3', 'attic-esp32', 96_567, 2.841, 48_283, 12],
  ['Official ESP8266 Miner 4.3', 'shed-8266', 41_920, 3.104, 21_004, 31],
  ['Official AVR Miner 4.3', 'uno-bench', 268, 8.912, 1_204, 3],
  ['RPI I2C AVR Miner 4.3', 'pi-cluster', 3_140, 5.221, 9_871, 7],
  ['Official PC Miner 4.3', 'workshop-pc', 1_284_400, 0.412, 184_002, 96],
  ['Official Web Miner 3.4', 'laptop-tab', 12_050, 6.700, 2_311, 44],
];

export const mockMiners: Miner[] = RIGS.map(
  ([software, identifier, hashrate, sharetime, accepted, rejected], i) => ({
    threadid: `demo${i.toString(16).padStart(12, '0')}`,
    username: 'demo',
    hashrate,
    sharetime,
    accepted,
    rejected,
    diff: hashrate > 500_000 ? 400_000 : hashrate > 50_000 ? 8_200 : 1_200,
    software,
    identifier,
    algorithm: 'DUCO-S1',
    pool: i % 3 === 0 ? 'south-america-node-1' : 'master-server-1',
    sharerate: Math.round(60 / sharetime),
    wd: String(1000 + i * 317),
  }),
);

/** Deterministic 40-hex digest, so demo hashes look like the real SHA-1 ones. */
function fakeHash(seed: number): string {
  let hash = '';
  let state = seed * 2_654_435_761;
  while (hash.length < 40) {
    state = (state ^ (state << 13)) >>> 0;
    state = (state ^ (state >>> 17)) >>> 0;
    state = (state ^ (state << 5)) >>> 0;
    hash += state.toString(16).padStart(8, '0');
  }
  return hash.slice(0, 40);
}

const tx = (
  id: number,
  datetime: string,
  sender: string,
  recipient: string,
  amount: number,
  memo: string,
): Transaction => ({
  id,
  datetime,
  sender,
  recipient,
  amount,
  memo,
  hash: fakeHash(id),
});

/** Covers every classifier branch: faucet, rewards, exchange, bridge, lottery, burn. */
export const mockTransactions: Transaction[] = [
  tx(1, '14/03/2025 09:12:44', 'faucet', 'demo', 4.21, 'Duino-Coin Faucet at faucet.duinocoin.com'),
  tx(2, '02/04/2025 17:40:10', 'Duino-Coin Masternode', 'demo', 25, 'Rewarded achievement: Kolkastart'),
  tx(3, '19/05/2025 11:03:55', 'Pastel', 'demo', 2.75, 'Pastel Faucet reward'),
  tx(4, '28/06/2025 22:19:01', 'coinexchange', 'demo', 5_000, 'Exchange purchase'),
  tx(5, '30/06/2025 08:44:29', 'demo', 'nephew_rig', 250, 'Starter pack'),
  tx(6, '11/08/2025 14:55:12', 'Lottery', 'demo', 1_820, 'Lottery win'),
  tx(7, '12/08/2025 09:00:00', 'demo', 'Lottery', 500, 'Lottery ticket'),
  tx(8, '03/10/2025 19:22:38', 'bscDUCO', 'demo', 1_500, 'Unwrapped from BSC'),
  tx(9, '25/12/2025 18:15:00', 'Duino-Coin Masternode', 'demo', 32.11, 'Christmas gift'),
  tx(10, '17/01/2026 07:31:47', 'faucet', 'demo', 3.9, 'Faucet claim'),
  tx(11, '22/02/2026 13:48:03', 'demo', 'coinburn', 1_000, 'Coin supply burning'),
  tx(12, '09/04/2026 16:05:20', 'demo', 'maticDUCO', 2_000, 'Wrapped to Polygon'),
  tx(13, '30/05/2026 12:00:00', 'Duino-Coin Masternode', 'demo', 15, 'Rewarded achievement: Mining expert'),
  tx(14, '21/07/2026 20:37:14', 'a_friend', 'demo', 640, 'thanks for the help'),
  tx(15, '05/08/2026 10:26:59', 'demo', 'exchange_buddy', 320, 'swap'),
];

export const mockUser: UserBundle = {
  balance: {
    username: 'demo',
    balance: 48_517.284913,
    verified: 'yes',
    created: '10/03/2025 20:33:34',
    stake_date: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 23,
    stake_amount: 12_000,
    last_login: Math.floor(Date.now() / 1000) - 3_600,
    trust_score: 5,
    max_miners: 116,
    verified_by: 'jpx13',
    warnings: 0,
  },
  miners: mockMiners,
  transactions: mockTransactions.slice(-8),
  prices: {
    bch: 0,
    bitstorage: 6.43e-5,
    fluffy: 0,
    furim: 0,
    max: 7.19e-5,
    nano: 7.98e-6,
    nodes: 0,
    pancake: 7.71824e-6,
    sunswap: 7.19e-5,
    sushi: 0,
    trx: 0,
    ubeswap: 7.6e-7,
    xmg: 0,
  },
};

/** A verbatim capture of /statistics, so the network panel renders real proportions. */
export const mockStatistics: Statistics = {
  'Active connections': 1340,
  'All-time mined DUCO': 998_866_973.716492,
  'Current difficulty': 200_000,
  'DUCO-S1 hashrate': '2.076 GH/s',
  'Duco Bitstorage price': 6.43e-5,
  'Duco FluffySwap price': 0,
  'Duco Furim price': 0,
  'Duco Node-S price': 0,
  'Duco PancakeSwap price': 7.71824e-6,
  'Duco SunSwap price': 7.192e-5,
  'Duco SushiSwap price': 0,
  'Duco UbeSwap price': 7.6e-7,
  'Duco price': 7.192e-5,
  'Duco price BCH': 0,
  'Duco price NANO': 7.98e-6,
  'Last update': '10/08/2026 18:28:49 (UTC)',
  'Mined blocks': 724_298_050_655,
  'Miner distribution': {
    All: 10_446,
    Arduino: 1_575,
    CPU: 448,
    ESP32: 4_702,
    ESP8266: 2_920,
    GPU: 0,
    Other: 19,
    Phone: 22,
    RPi: 674,
    Web: 86,
  },
  'Net energy usage': '7.73 kW',
  'Pool hashrate': '2075.726 MH/s',
  'Registered users': 124_476,
  'Top 10 richest miners': [
    '171529337.9679388 DUCO - coinexchange',
    '101167894.42961511 DUCO - bscDUCO',
    '33811483.41454351 DUCO - DucoNode',
    '32738670.524030983 DUCO - AlmarRido',
    '30480607.133495547 DUCO - Flowen1985',
  ],
  transaction_count: 2_538_019,
};

/**
 * 90 days of best-price history. Includes zero-valued days on purpose — the live
 * endpoint records collector failures as `price: 0`, and the chart must treat those
 * as gaps rather than plotting a crash to zero.
 */
export const mockHistoricPrices: HistoricPrice[] = Array.from({ length: 90 }, (_, i) => {
  const daysAgo = 89 - i;
  const t = Date.now() - daysAgo * 86_400_000;
  const date = new Date(t);
  const wave = Math.sin(i / 7) * 6e-6 + Math.sin(i / 23) * 9e-6;
  const drift = i * 1.4e-7;
  return {
    day: date.toISOString().slice(0, 10),
    day_unix: Math.floor(t / 1000),
    price: i % 29 === 17 ? 0 : Math.max(1e-6, 6.1e-5 + wave + drift),
  };
});
