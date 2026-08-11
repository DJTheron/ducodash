import { z } from 'zod';
import { getJson } from './client';
import {
  historicDataSchema,
  historicPriceSchema,
  statisticsSchema,
  transactionSchema,
  userSchema,
  type HistoricDatum,
  type HistoricPrice,
  type Statistics,
  type Transaction,
  type UserBundle,
} from './schema';

type Opts = { signal?: AbortSignal };

/** Balance, rigs, recent transactions and venue prices in one request. */
export function fetchUser(username: string, opts: Opts = {}): Promise<UserBundle> {
  return getJson(`/v2/users/${encodeURIComponent(username)}?limit=20`, userSchema, opts);
}

/**
 * Full history. The source-of-truth for the "where did it come from" breakdown —
 * the 20 transactions bundled with /v2/users are nowhere near enough to attribute
 * lifetime flows.
 */
export function fetchAllTransactions(username: string, opts: Opts = {}): Promise<Transaction[]> {
  return getJson(
    `/user_transactions/${encodeURIComponent(username)}?limit=5000`,
    z.array(transactionSchema).catch([]),
    opts,
  );
}

export function fetchStatistics(opts: Opts = {}): Promise<Statistics> {
  return getJson('/statistics', statisticsSchema, opts);
}

/**
 * The server's own best-price-per-day series. Days where the collector failed are
 * recorded as `price: 0`, which is a gap and not a real price — callers must drop
 * them rather than plot a crash to zero.
 */
export function fetchHistoricPrices(limit = 90, opts: Opts = {}): Promise<HistoricPrice[]> {
  return getJson(
    `/historic_prices?currency=max&limit=${limit}`,
    z.array(historicPriceSchema).catch([]),
    opts,
  );
}

export function fetchHistoricData(limit = 30, opts: Opts = {}): Promise<HistoricDatum[]> {
  return getJson(`/historic_data?limit=${limit}`, z.array(historicDataSchema).catch([]), opts);
}
