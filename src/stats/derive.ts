import type { Balance, Transaction } from '../api/schema';
import { parseDucoDate } from '../lib/format';
import {
  classifyTransaction,
  type ClassifiedTransaction,
  type InflowKind,
  type OutflowKind,
} from './classify';

export type FlowTotals = {
  inflow: Record<InflowKind, number>;
  outflow: Record<OutflowKind, number>;
  totalIn: number;
  totalOut: number;
  /** Derived, not reported. See `deriveMined`. */
  mined: number;
  minedIsReliable: boolean;
};

const emptyInflow = (): Record<InflowKind, number> => ({
  faucet: 0,
  rewards: 0,
  exchange: 0,
  unwrapped: 0,
  lottery: 0,
  received: 0,
});

const emptyOutflow = (): Record<OutflowKind, number> => ({
  sent: 0,
  wrapped: 0,
  burned: 0,
  lotteryOut: 0,
  exchangeOut: 0,
});

/**
 * Mining income is not a transaction.
 *
 * The server credits mining rewards straight onto the balance row; nothing is
 * written to the transactions table. So mined DUCO can only be recovered as the
 * residual of everything else:
 *
 *     mined = balance - (all inflows) + (all outflows)
 *
 * Caveats worth stating in the UI rather than hiding: staking payouts and Kolka
 * penalties also move the balance without a matching transaction, and a history
 * truncated by the API's row limit will overstate the residual. Hence
 * `minedIsReliable`.
 */
export function deriveMined(balance: number, totalIn: number, totalOut: number): number {
  return balance - totalIn + totalOut;
}

export function computeFlows(
  transactions: ClassifiedTransaction[],
  balance: number,
  historyComplete: boolean,
): FlowTotals {
  const inflow = emptyInflow();
  const outflow = emptyOutflow();

  for (const tx of transactions) {
    const amount = Math.abs(tx.amount);
    if (tx.direction === 'in') inflow[tx.kind as InflowKind] += amount;
    else outflow[tx.kind as OutflowKind] += amount;
  }

  const totalIn = Object.values(inflow).reduce((a, b) => a + b, 0);
  const totalOut = Object.values(outflow).reduce((a, b) => a + b, 0);
  const mined = deriveMined(balance, totalIn, totalOut);

  return {
    inflow,
    outflow,
    totalIn,
    totalOut,
    // A negative residual means the transactions can't be reconciled with the
    // balance — almost always a truncated history. Better to flag it than to draw
    // a negative "mined" segment.
    mined: Math.max(0, mined),
    minedIsReliable: historyComplete && mined >= 0,
  };
}

export type Counterparty = { name: string; received: number; sent: number; count: number };

export type WalletStats = {
  transactions: ClassifiedTransaction[];
  flows: FlowTotals;
  firstActivity: Date | null;
  lastActivity: Date | null;
  accountAge: Date | null;
  largestReceived: ClassifiedTransaction | null;
  largestSent: ClassifiedTransaction | null;
  topCounterparties: Counterparty[];
  netFlow: number;
  txCount: number;
  /** Balance over time, oldest first — reconstructed, see `balanceSeries`. */
  history: { t: number; balance: number }[];
};

export function computeWalletStats(
  raw: Transaction[],
  balanceRow: Balance,
  historyComplete: boolean,
): WalletStats {
  const username = balanceRow.username;
  const transactions = raw
    .map((tx) => classifyTransaction(tx, username))
    .sort((a, b) => (parseDucoDate(a.datetime)?.getTime() ?? 0) - (parseDucoDate(b.datetime)?.getTime() ?? 0));

  const flows = computeFlows(transactions, balanceRow.balance, historyComplete);

  const inbound = transactions.filter((t) => t.direction === 'in');
  const outbound = transactions.filter((t) => t.direction === 'out');
  const biggest = (list: ClassifiedTransaction[]) =>
    list.length === 0
      ? null
      : list.reduce((best, t) => (Math.abs(t.amount) > Math.abs(best.amount) ? t : best));

  const counterparties = new Map<string, Counterparty>();
  for (const tx of transactions) {
    const key = tx.counterparty;
    const entry = counterparties.get(key) ?? { name: key, received: 0, sent: 0, count: 0 };
    if (tx.direction === 'in') entry.received += Math.abs(tx.amount);
    else entry.sent += Math.abs(tx.amount);
    entry.count += 1;
    counterparties.set(key, entry);
  }

  return {
    transactions,
    flows,
    firstActivity: transactions.length ? parseDucoDate(transactions[0]!.datetime) : null,
    lastActivity: transactions.length
      ? parseDucoDate(transactions[transactions.length - 1]!.datetime)
      : null,
    accountAge: balanceRow.created ? parseDucoDate(balanceRow.created) : null,
    largestReceived: biggest(inbound),
    largestSent: biggest(outbound),
    topCounterparties: [...counterparties.values()]
      .sort((a, b) => b.received + b.sent - (a.received + a.sent))
      .slice(0, 5),
    netFlow: flows.totalIn - flows.totalOut,
    txCount: transactions.length,
    history: balanceSeries(transactions, balanceRow.balance),
  };
}

/**
 * Reconstruct a balance curve by walking transactions backwards from the current
 * balance.
 *
 * Because mining credits leave no transaction, the walk-back only accounts for
 * transfers — so the curve shows the *transfer-adjusted* balance, and mining income
 * appears as the implicit drift between points rather than as steps. Labelled as
 * such in the UI.
 */
export function balanceSeries(
  transactions: ClassifiedTransaction[],
  currentBalance: number,
): { t: number; balance: number }[] {
  const dated = transactions
    .map((tx) => ({ tx, date: parseDucoDate(tx.datetime) }))
    .filter((e): e is { tx: ClassifiedTransaction; date: Date } => e.date !== null);

  if (dated.length === 0) return [];

  const points: { t: number; balance: number }[] = [
    { t: Date.now(), balance: currentBalance },
  ];

  let running = currentBalance;
  for (let i = dated.length - 1; i >= 0; i--) {
    const { tx, date } = dated[i]!;
    // Undo this transaction to get the balance immediately before it.
    running += tx.direction === 'in' ? -Math.abs(tx.amount) : Math.abs(tx.amount);
    points.push({ t: date.getTime(), balance: running });
  }

  return points.reverse();
}
