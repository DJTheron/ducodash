import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchAllTransactions,
  fetchHistoricPrices,
  fetchStatistics,
  fetchUser,
} from '../api/endpoints';
import type { HistoricPrice, Miner, Statistics, Transaction, UserBundle } from '../api/schema';
import { buildExchangeReport } from '../exchange/report';
import { nominalPrice, readVenuePrices } from '../exchange/prices';
import type { ExchangeReport } from '../exchange/types';
import { computeWalletStats, type WalletStats } from '../stats/derive';
import {
  mockHistoricPrices,
  mockStatistics,
  mockTransactions,
  mockUser,
} from '../mock/fixtures';
import { mockExchangeReport } from '../mock/exchange';

/** /user_transactions is requested with this cap; hitting it means history is partial. */
const TX_LIMIT = 5000;
const POLL_MS = 30_000;

export const DEMO_USER = 'demo';

export function isMockMode(username: string): boolean {
  if (username.toLowerCase() === DEMO_USER) return true;
  return new URLSearchParams(window.location.search).get('mock') === '1';
}

/** Username from `?u=`, falling back to the last one used, then the demo account. */
export function readInitialUsername(): string {
  const fromUrl = new URLSearchParams(window.location.search).get('u');
  if (fromUrl) return fromUrl;
  try {
    return localStorage.getItem('ducodash:username') ?? DEMO_USER;
  } catch {
    return DEMO_USER;
  }
}

export function persistUsername(username: string): void {
  try {
    localStorage.setItem('ducodash:username', username);
  } catch {
    // Private browsing: a lost preference is not worth surfacing.
  }
  const url = new URL(window.location.href);
  url.searchParams.set('u', username);
  window.history.replaceState({}, '', url);
}

export type DashboardState = {
  username: string;
  user: UserBundle | null;
  statistics: Statistics | null;
  transactions: Transaction[];
  historicPrices: HistoricPrice[];
  wallet: WalletStats | null;
  exchange: ExchangeReport | null;
  /** True while the very first load is in flight; refreshes don't set it. */
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  historyComplete: boolean;
  lastUpdated: number | null;
  refresh: () => void;
};

export function useDashboard(username: string): DashboardState {
  const [user, setUser] = useState<UserBundle | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [historicPrices, setHistoricPrices] = useState<HistoricPrice[]>([]);
  const [exchange, setExchange] = useState<ExchangeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  const loadedFor = useRef<string | null>(null);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!username) return;
    const controller = new AbortController();
    const mock = isMockMode(username);
    const firstLoad = loadedFor.current !== username;

    if (firstLoad) {
      setLoading(true);
      setUser(null);
      setExchange(null);
      setError(null);
    } else {
      setRefreshing(true);
    }

    (async () => {
      try {
        if (mock) {
          setUser(mockUser);
          setStatistics(mockStatistics);
          setTransactions(mockTransactions);
          setHistoricPrices(mockHistoricPrices);
        } else {
          // The user bundle and network stats are what the page needs to render;
          // history and price series are enrichments and must not block or break it.
          const [bundle, stats] = await Promise.all([
            fetchUser(username, { signal: controller.signal }),
            fetchStatistics({ signal: controller.signal }),
          ]);
          setUser(bundle);
          setStatistics(stats);

          const [txs, prices] = await Promise.all([
            fetchAllTransactions(username, { signal: controller.signal }).catch(() => []),
            fetchHistoricPrices(90, { signal: controller.signal }).catch(() => []),
          ]);
          setTransactions(txs.length > 0 ? txs : bundle.transactions);
          setHistoricPrices(prices);
        }
        setError(null);
        setLastUpdated(Date.now());
        loadedFor.current = username;
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => controller.abort();
  }, [username, tick]);

  // Depth modelling is a separate, slower pipeline hitting three third-party hosts.
  // Keeping it off the main load means a chain RPC hiccup never blanks the balance.
  const balance = user?.balance.balance ?? 0;
  const mock = isMockMode(username);
  useEffect(() => {
    if (!statistics || balance <= 0) return;

    // The demo runs the same depth model against captured reserves, so it shows the
    // panel's real behaviour without depending on three third-party hosts.
    if (mock) {
      setExchange(mockExchangeReport(balance, readVenuePrices(statistics)));
      return undefined;
    }

    const controller = new AbortController();

    buildExchangeReport(
      balance,
      readVenuePrices(statistics),
      nominalPrice(statistics),
      controller.signal,
    )
      .then((report) => {
        if (!controller.signal.aborted) setExchange(report);
      })
      .catch(() => {
        // Leave the previous report standing rather than flashing an empty panel.
      });

    return () => controller.abort();
  }, [statistics, balance, mock]);

  // Background refresh, paused while the tab is hidden so we don't burn the
  // server's 60-requests-per-minute budget on a page nobody is looking at.
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const historyComplete = transactions.length < TX_LIMIT;

  const wallet = useMemo(
    () => (user ? computeWalletStats(transactions, user.balance, historyComplete) : null),
    [user, transactions, historyComplete],
  );

  return {
    username,
    user,
    statistics,
    transactions,
    historicPrices,
    wallet,
    exchange,
    loading,
    refreshing,
    error,
    historyComplete,
    lastUpdated,
    refresh,
  };
}

/**
 * Rolling per-rig hashrate samples, keyed by thread id.
 *
 * The API only reports an instantaneous hashrate, so any trend line has to be
 * accumulated client-side over the session. Deliberately not persisted — a stale
 * curve from yesterday would be worse than no curve.
 */
export function useHashrateHistory(miners: Miner[], depth = 40): Map<string, number[]> {
  const [history, setHistory] = useState<Map<string, number[]>>(new Map());

  useEffect(() => {
    if (miners.length === 0) return;
    setHistory((prev) => {
      const next = new Map(prev);
      for (const miner of miners) {
        const series = [...(next.get(miner.threadid) ?? []), miner.hashrate];
        next.set(miner.threadid, series.slice(-depth));
      }
      // Drop rigs that have gone offline so the map can't grow without bound.
      const live = new Set(miners.map((m) => m.threadid));
      for (const key of next.keys()) if (!live.has(key)) next.delete(key);
      return next;
    });
  }, [miners, depth]);

  return history;
}
