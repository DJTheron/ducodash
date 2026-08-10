import type { Transaction } from '../api/schema';

/*
  Where the DUCO came from, and where it went.

  Every rule below was derived from real transaction histories pulled from the live
  API, not from documentation — there is no documented transaction taxonomy. The
  memo field turns out to be far more reliable than the sender name (faucets are run
  by ordinary user accounts with arbitrary names, but they all stamp a memo), so
  memos are matched first.
*/

export type InflowKind = 'faucet' | 'rewards' | 'exchange' | 'unwrapped' | 'lottery' | 'received';
export type OutflowKind = 'sent' | 'wrapped' | 'burned' | 'lotteryOut' | 'exchangeOut';
export type FlowKind = InflowKind | OutflowKind;

export const INFLOW_LABELS: Record<InflowKind, string> = {
  faucet: 'Faucets',
  rewards: 'Rewards & achievements',
  exchange: 'Bought on exchange',
  unwrapped: 'Unwrapped from chain',
  lottery: 'Lottery wins',
  received: 'Received from people',
};

export const OUTFLOW_LABELS: Record<OutflowKind, string> = {
  sent: 'Sent to people',
  wrapped: 'Wrapped to chain',
  burned: 'Burned',
  lotteryOut: 'Lottery entries',
  exchangeOut: 'Sold on exchange',
};

/** System accounts. Bridges mint/burn DUCO against a wrapped token on another chain. */
const BRIDGE_ACCOUNTS = new Set(['bscduco', 'maticduco', 'celoduco', 'wduco', 'duco-bridge']);
const EXCHANGE_ACCOUNTS = new Set(['coinexchange', 'bitstorage']);
const BURN_ACCOUNTS = new Set(['coinburn']);
const LOTTERY_ACCOUNTS = new Set(['lottery']);
const REWARD_ACCOUNTS = new Set(['duino-coin masternode', 'masternode', 'duco-achievements']);

const FAUCET_MEMO = /faucet|claim(ed)?\s+(from|at)|free\s+duco/i;
const REWARD_MEMO = /rewarded achievement|achievement|easter egg|gift|giveaway|bonus/i;
const LOTTERY_MEMO = /lottery|raffle|jackpot/i;
const WRAP_MEMO = /\bwrap(ped|ping)?\b|\bunwrap(ped|ping)?\b|bridge/i;
const BURN_MEMO = /\bburn(ing|ed)?\b|supply burn/i;

const norm = (s: string) => s.trim().toLowerCase();

export type ClassifiedTransaction = Transaction & {
  direction: 'in' | 'out';
  kind: FlowKind;
  counterparty: string;
};

export function classifyTransaction(tx: Transaction, username: string): ClassifiedTransaction {
  const me = norm(username);
  const sender = norm(tx.sender);
  const recipient = norm(tx.recipient);
  const memo = tx.memo ?? '';

  // A self-send is neither a source nor a use; treat it as outbound so it never
  // inflates income.
  const direction: 'in' | 'out' = recipient === me && sender !== me ? 'in' : 'out';
  const counterparty = direction === 'in' ? tx.sender : tx.recipient;
  const other = direction === 'in' ? sender : recipient;

  const kind: FlowKind =
    direction === 'in' ? inflowKind(other, memo) : outflowKind(other, memo);

  return { ...tx, direction, kind, counterparty };
}

function inflowKind(sender: string, memo: string): InflowKind {
  if (FAUCET_MEMO.test(memo)) return 'faucet';
  if (BRIDGE_ACCOUNTS.has(sender) || WRAP_MEMO.test(memo)) return 'unwrapped';
  if (EXCHANGE_ACCOUNTS.has(sender)) return 'exchange';
  if (LOTTERY_ACCOUNTS.has(sender) || LOTTERY_MEMO.test(memo)) return 'lottery';
  if (REWARD_ACCOUNTS.has(sender) || REWARD_MEMO.test(memo)) return 'rewards';
  return 'received';
}

function outflowKind(recipient: string, memo: string): OutflowKind {
  if (BURN_ACCOUNTS.has(recipient) || BURN_MEMO.test(memo)) return 'burned';
  if (BRIDGE_ACCOUNTS.has(recipient) || WRAP_MEMO.test(memo)) return 'wrapped';
  if (EXCHANGE_ACCOUNTS.has(recipient)) return 'exchangeOut';
  if (LOTTERY_ACCOUNTS.has(recipient) || LOTTERY_MEMO.test(memo)) return 'lotteryOut';
  return 'sent';
}
