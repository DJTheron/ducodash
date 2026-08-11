/*
  Minimal chain access.

  Everything here runs in the browser against public, CORS-enabled endpoints — all
  of the hosts below were checked to return `Access-Control-Allow-Origin: *`, which
  is what makes the depth modelling possible from a static GitHub Pages site with no
  backend.
*/

const BSC_RPCS = [
  'https://bsc-dataseed.binance.org',
  'https://bsc-rpc.publicnode.com',
  'https://bsc-dataseed1.bnbchain.org',
];

const TRON_API = 'https://api.trongrid.io';
export const DEXSCREENER = 'https://api.dexscreener.com/latest/dex';

type RpcCall = { to: string; data: string };

/**
 * Batched `eth_call`.
 *
 * Falls through the RPC list on transport failure — public endpoints rate-limit and
 * go down individually, and one bad host shouldn't blank the panel.
 *
 * An individual call that reverts yields `null` for that slot rather than failing
 * the batch: DexScreener lists Uniswap-V3 and bespoke pools alongside V2 ones, and
 * `getReserves()` reverts on those. One incompatible pool must not take out the
 * venues that did answer.
 */
export async function evmBatchCall(
  calls: RpcCall[],
  signal?: AbortSignal,
): Promise<(string | null)[]> {
  const payload = calls.map((call, i) => ({
    jsonrpc: '2.0',
    id: i,
    method: 'eth_call',
    params: [{ to: call.to, data: call.data }, 'latest'],
  }));

  let lastError: unknown;
  for (const rpc of BSC_RPCS) {
    try {
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { id: number; result?: string; error?: unknown }[];
      if (!Array.isArray(body)) throw new Error('Batch response was not an array');

      const out = new Array<string | null>(calls.length).fill(null);
      for (const entry of body) {
        out[entry.id] = typeof entry.result === 'string' && !entry.error ? entry.result : null;
      }
      // Only a wholesale failure justifies trying the next endpoint.
      if (out.every((r) => r === null)) throw new Error('Every call in the batch failed');
      return out;
    } catch (err) {
      if (signal?.aborted) throw err;
      lastError = err;
    }
  }
  throw new Error(`All BSC RPCs failed: ${String(lastError)}`);
}

export async function evmGasPriceWei(signal?: AbortSignal): Promise<bigint | null> {
  for (const rpc of BSC_RPCS) {
    try {
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_gasPrice', params: [] }),
        signal,
      });
      const body = (await res.json()) as { result?: string };
      if (typeof body.result === 'string') return BigInt(body.result);
    } catch {
      // Try the next endpoint; a missing gas price only costs us the cost estimate.
    }
  }
  return null;
}

/** Decode one 32-byte word from an ABI-encoded return value. */
export function word(hex: string, index: number): bigint {
  const body = hex.startsWith('0x') ? hex.slice(2) : hex;
  const slice = body.slice(index * 64, (index + 1) * 64);
  return slice ? BigInt(`0x${slice}`) : 0n;
}

/** Decode a 20-byte address from a 32-byte word. */
export function addressWord(hex: string): string {
  const body = hex.startsWith('0x') ? hex.slice(2) : hex;
  return `0x${body.slice(24, 64)}`.toLowerCase();
}

// Function selectors used below.
export const SELECTOR = {
  getReserves: '0x0902f1ac',
  token0: '0x0dfe1681',
  decimals: '0x313ce567',
} as const;

export type TronAccount = { trxSun: bigint; trc20: Record<string, bigint> };

/**
 * TRON account state.
 *
 * A SunSwap V1 exchange *is* an account: it simply holds TRX and the paired TRC-20,
 * and those two balances are the pool reserves. No contract call needed.
 */
export async function tronAccount(address: string, signal?: AbortSignal): Promise<TronAccount | null> {
  const res = await fetch(`${TRON_API}/v1/accounts/${address}`, { signal });
  if (!res.ok) throw new Error(`TronGrid HTTP ${res.status}`);
  const body = (await res.json()) as {
    data?: { balance?: number; trc20?: Record<string, string>[] }[];
  };
  const account = body.data?.[0];
  if (!account) return null;

  const trc20: Record<string, bigint> = {};
  for (const entry of account.trc20 ?? []) {
    for (const [token, amount] of Object.entries(entry)) {
      try {
        trc20[token] = BigInt(amount);
      } catch {
        // Ignore unparseable balances rather than failing the whole read.
      }
    }
  }
  return { trxSun: BigInt(account.balance ?? 0), trc20 };
}

/**
 * Read a TRC-20's `decimals()`.
 *
 * Worth a request of its own: getting this wrong scales every price on the venue by
 * a power of ten, and it is exactly the sort of constant that goes stale unnoticed.
 * Returns null on failure so the caller can fall back to its verified default.
 */
export async function tronTokenDecimals(
  token: string,
  signal?: AbortSignal,
): Promise<number | null> {
  try {
    const res = await fetch(`${TRON_API}/wallet/triggerconstantcontract`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal,
      body: JSON.stringify({
        owner_address: token,
        contract_address: token,
        function_selector: 'decimals()',
        parameter: '',
        visible: true,
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { constant_result?: string[] };
    const hex = body.constant_result?.[0];
    if (!hex) return null;
    const value = Number(BigInt(`0x${hex}`));
    return Number.isInteger(value) && value >= 0 && value <= 24 ? value : null;
  } catch {
    return null;
  }
}

/** TRX in USD. Only needed for the TRON venue, which has no DexScreener coverage. */
export async function fetchTrxUsd(signal?: AbortSignal): Promise<number | null> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=tron&vs_currencies=usd',
      { signal },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { tron?: { usd?: number } };
    const usd = body.tron?.usd;
    return typeof usd === 'number' && usd > 0 ? usd : null;
  } catch {
    return null;
  }
}

export type DexPair = {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; symbol: string };
  quoteToken: { address: string; symbol: string };
  priceUsd?: string;
  priceNative?: string;
  liquidity?: { usd?: number };
};

export async function fetchDexPairs(token: string, signal?: AbortSignal): Promise<DexPair[]> {
  const res = await fetch(`${DEXSCREENER}/tokens/${token}`, { signal });
  if (!res.ok) throw new Error(`DexScreener HTTP ${res.status}`);
  const body = (await res.json()) as { pairs?: DexPair[] | null };
  return body.pairs ?? [];
}
