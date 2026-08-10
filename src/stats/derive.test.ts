import { describe, expect, it } from 'vitest';
import type { Balance, Transaction } from '../api/schema';
import { classifyTransaction } from './classify';
import { computeFlows, computeWalletStats, deriveMined } from './derive';

const tx = (over: Partial<Transaction>): Transaction => ({
  datetime: '01/01/2026 12:00:00',
  sender: 'someone',
  recipient: 'me',
  amount: 10,
  hash: 'abc',
  memo: 'None',
  id: 1,
  ...over,
});

describe('classifyTransaction', () => {
  it('reads faucet income from the memo, not the sender name', () => {
    // Real faucets run under ordinary usernames; the memo is the dependable signal.
    const result = classifyTransaction(
      tx({ sender: 'Mclarenboy001', memo: 'Faucet claim' }),
      'me',
    );
    expect(result.kind).toBe('faucet');
    expect(result.direction).toBe('in');
  });

  it('recognises the faucet memos actually seen in the wild', () => {
    for (const memo of [
      'Pastel Faucet reward',
      'Duino-Coin Faucet at faucet.duinocoin.com',
      'amogus faucet https://duco-faucet.pcgeek.pl/',
    ]) {
      expect(classifyTransaction(tx({ memo }), 'me').kind).toBe('faucet');
    }
  });

  it('separates achievements from ordinary transfers', () => {
    const result = classifyTransaction(
      tx({ sender: 'Duino-Coin Masternode', memo: 'Rewarded achievement: Mining expert' }),
      'me',
    );
    expect(result.kind).toBe('rewards');
  });

  it('detects burns, lottery and exchange flows in both directions', () => {
    expect(
      classifyTransaction(
        tx({ sender: 'me', recipient: 'coinburn', memo: 'Coin supply burning' }),
        'me',
      ).kind,
    ).toBe('burned');
    expect(classifyTransaction(tx({ sender: 'me', recipient: 'Lottery' }), 'me').kind).toBe(
      'lotteryOut',
    );
    expect(classifyTransaction(tx({ sender: 'Lottery' }), 'me').kind).toBe('lottery');
    expect(classifyTransaction(tx({ sender: 'coinexchange' }), 'me').kind).toBe('exchange');
    expect(classifyTransaction(tx({ sender: 'bscDUCO' }), 'me').kind).toBe('unwrapped');
  });

  it('is case-insensitive about the username', () => {
    expect(classifyTransaction(tx({ recipient: 'ME' }), 'me').direction).toBe('in');
  });

  it('does not count a self-send as income', () => {
    expect(classifyTransaction(tx({ sender: 'me', recipient: 'me' }), 'me').direction).toBe('out');
  });

  it('falls back to a plain transfer', () => {
    expect(classifyTransaction(tx({ sender: 'a_friend' }), 'me').kind).toBe('received');
  });
});

describe('deriveMined', () => {
  /*
    Mining rewards never appear as transactions — the server credits the balance
    row directly — so mined DUCO is only recoverable as a residual.
  */
  it('recovers mining income as the residual', () => {
    // Balance 1000, received 200, sent 50 => mined 850.
    expect(deriveMined(1000, 200, 50)).toBe(850);
  });

  it('is zero when every coin is accounted for by transfers', () => {
    expect(deriveMined(200, 200, 0)).toBe(0);
  });
});

describe('computeFlows', () => {
  const classified = (list: Transaction[]) => list.map((t) => classifyTransaction(t, 'me'));

  it('totals each bucket and derives the remainder as mined', () => {
    const flows = computeFlows(
      classified([
        tx({ sender: 'faucetbot', memo: 'Faucet claim', amount: 5 }),
        tx({ sender: 'coinexchange', amount: 100 }),
        tx({ sender: 'me', recipient: 'friend', amount: 30 }),
      ]),
      1000,
      true,
    );

    expect(flows.inflow.faucet).toBe(5);
    expect(flows.inflow.exchange).toBe(100);
    expect(flows.outflow.sent).toBe(30);
    expect(flows.totalIn).toBe(105);
    expect(flows.totalOut).toBe(30);
    expect(flows.mined).toBe(925);
    expect(flows.minedIsReliable).toBe(true);
  });

  it('flags an unreliable residual instead of drawing a negative segment', () => {
    // More received than the balance holds: the history must be truncated.
    const flows = computeFlows(classified([tx({ amount: 5000 })]), 100, true);
    expect(flows.mined).toBe(0);
    expect(flows.minedIsReliable).toBe(false);
  });

  it('marks the residual unreliable when history is known to be capped', () => {
    const flows = computeFlows(classified([tx({ amount: 10 })]), 1000, false);
    expect(flows.minedIsReliable).toBe(false);
  });
});

describe('computeWalletStats', () => {
  const balance: Balance = { username: 'me', balance: 500, created: '01/01/2025 00:00:00' };

  it('orders history oldest-first and reconstructs the balance curve', () => {
    const stats = computeWalletStats(
      [
        tx({ id: 2, datetime: '10/02/2026 00:00:00', amount: 100, sender: 'x' }),
        tx({ id: 1, datetime: '05/01/2026 00:00:00', amount: 50, sender: 'y' }),
      ],
      balance,
      true,
    );

    expect(stats.transactions.map((t) => t.id)).toEqual([1, 2]);
    // Curve ends at the current balance and steps back through each transfer.
    expect(stats.history.at(-1)!.balance).toBe(500);
    expect(stats.history[0]!.balance).toBe(350);
  });

  it('parses day-first dates rather than treating them as US month-first', () => {
    const stats = computeWalletStats(
      [tx({ datetime: '03/10/2025 00:00:00' })],
      balance,
      true,
    );
    // 3 October, not 10 March.
    expect(stats.firstActivity?.getUTCMonth()).toBe(9);
    expect(stats.firstActivity?.getUTCDate()).toBe(3);
  });

  it('finds the largest movement in each direction', () => {
    const stats = computeWalletStats(
      [
        tx({ id: 1, amount: 10, sender: 'a' }),
        tx({ id: 2, amount: 900, sender: 'b' }),
        tx({ id: 3, amount: 70, sender: 'me', recipient: 'c' }),
      ],
      balance,
      true,
    );
    expect(stats.largestReceived?.amount).toBe(900);
    expect(stats.largestSent?.amount).toBe(70);
  });

  it('survives an empty history', () => {
    const stats = computeWalletStats([], balance, true);
    expect(stats.txCount).toBe(0);
    expect(stats.history).toEqual([]);
    expect(stats.flows.mined).toBe(500);
  });
});
