import { z } from 'zod';

/*
  Schemas for the Duino-Coin REST API (https://server.duinocoin.com).

  Two things about this API drive every choice here:

  1. Failures come back as HTTP 200 with `{success: false, message: "..."}`. Branching
     on response.ok silently accepts error bodies as data. `unwrap()` in client.ts is
     the only place allowed to read `success`.
  2. The response shape drifts. Fields observed live in 2026 (`max_miners`,
     `trust_score`, `verified_by`, `warnings`, `sharerate`, `pg`, `it`) do not exist in
     the published server source. So every object is loose (unknown keys pass through)
     and everything not load-bearing is optional — a new field must never blank the
     dashboard.
*/

const numeric = z.union([z.number(), z.string()]).pipe(z.coerce.number());

export const balanceSchema = z.looseObject({
  username: z.string(),
  balance: numeric,
  verified: z.string().optional(),
  created: z.string().optional(),
  stake_date: numeric.optional(),
  stake_amount: numeric.optional(),
  last_login: numeric.optional(),
  // Seen live but absent from the published source.
  trust_score: numeric.optional(),
  max_miners: numeric.optional(),
  verified_by: z.string().optional(),
  verified_date: numeric.optional(),
  warnings: numeric.optional(),
});

export const minerSchema = z.looseObject({
  threadid: z.string(),
  username: z.string(),
  hashrate: numeric,
  sharetime: numeric,
  accepted: numeric,
  rejected: numeric,
  diff: numeric,
  software: z.string(),
  identifier: z.string(),
  algorithm: z.string(),
  pool: z.string().optional(),
  sharerate: numeric.optional(),
  // `wd` arrives as a string ("2432") despite being numeric server-side.
  wd: z.union([z.string(), z.number()]).optional(),
});

export const transactionSchema = z.looseObject({
  datetime: z.string(),
  sender: z.string(),
  recipient: z.string(),
  amount: numeric,
  hash: z.string(),
  memo: z.string(),
  id: numeric,
});

export const userSchema = z.looseObject({
  balance: balanceSchema,
  miners: z.array(minerSchema).catch([]),
  transactions: z.array(transactionSchema).catch([]),
  prices: z.record(z.string(), numeric).catch({}),
});

export const historicPriceSchema = z.looseObject({
  day: z.string(),
  day_unix: numeric,
  price: numeric,
});

export const historicDataSchema = z.looseObject({
  day: z.string(),
  day_unix: numeric.optional(),
  hashrate: z.string(),
  miners: numeric,
  users: numeric,
});

/*
  /statistics is a flat bag of human-readable keys ("Pool hashrate", "Duco price",
  "Duco PancakeSwap price"). Venue prices are read by pattern, never by a hardcoded
  list — "Duco Bitstorage price" appeared some time after 2024 and would otherwise
  have been invisible. Kept loose deliberately.
*/
export const statisticsSchema = z.looseObject({
  'Duco price': numeric.optional(),
  'Pool hashrate': z.string().optional(),
  'Current difficulty': numeric.optional(),
  'Active connections': numeric.optional(),
  'Registered users': numeric.optional(),
  'All-time mined DUCO': numeric.optional(),
  'Mined blocks': numeric.optional(),
  'Net energy usage': z.string().optional(),
  'Last update': z.string().optional(),
  'Miner distribution': z.record(z.string(), numeric).optional(),
  'Top 10 richest miners': z.array(z.string()).optional(),
  transaction_count: numeric.optional(),
});

export type Balance = z.infer<typeof balanceSchema>;
export type Miner = z.infer<typeof minerSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type UserBundle = z.infer<typeof userSchema>;
export type HistoricPrice = z.infer<typeof historicPriceSchema>;
export type HistoricDatum = z.infer<typeof historicDataSchema>;
export type Statistics = z.infer<typeof statisticsSchema>;
