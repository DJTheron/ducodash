import {
  addressWord,
  evmBatchCall,
  evmGasPriceWei,
  fetchDexPairs,
  fetchTrxUsd,
  SELECTOR,
  tronAccount,
  tronTokenDecimals,
  word,
  type DexPair,
} from './chains';
import { simulateSell } from './univ2';
import type { Venue, VenueQuote } from './types';

/*
  Verified venue constants.

  Every address below was confirmed against live chain state on 2026-08-10 rather
  than copied from documentation:

  - bscDUCO 0xCF57…785b — decimals() returned 18 on-chain; DexScreener indexes six
    PancakeSwap pairs against it.
  - wDUCO TWYaXdxA12… on TRON — symbol() returns "wDUCO" and decimals() returns 6.
    Cross-check: the SunSwap V1 exchange below holds 816,577.816 wDUCO against
    177.511 TRX, which implies $7.19e-05/DUCO and matches the "Duco SunSwap price"
    the Duino-Coin server itself publishes.

  Pair addresses are deliberately NOT hardcoded — BSC pairs are discovered through
  DexScreener at runtime so a new or migrated pool is picked up automatically. The
  TRON token's decimals are likewise re-read at runtime, with the verified value
  below as the fallback; a wrong decimals constant silently scales every price by a
  power of ten, so it is not something to trust to a comment.
*/
const BSC_DUCO = '0xCF572cA0AB84d8Ce1652b175e930292E2320785b';
const TRON_WDUCO = 'TWYaXdxA12JywrUdou3PFD1fvx2PWjqK9U';
const TRON_SUNSWAP_EXCHANGE = 'TRAoFeB7n8Tt4nZGTRB8La4UP4i84bsoMh';
const TRON_WDUCO_DECIMALS_FALLBACK = 6;
const TRX_DECIMALS = 6;

/** PancakeSwap V2 charges 25 bps; SunSwap/JustSwap V1 charges 30. */
const PANCAKE_FEE_BPS = 25;
const SUNSWAP_FEE_BPS = 30;

/** Typical gas for a V2 swap. Multiplied by the live gas price, not guessed at. */
const SWAP_GAS_UNITS = 150_000n;

/**
 * TRON charges bandwidth/energy rather than a gas price we can read generically.
 * The official wDUCO tutorial puts the network fee at roughly 5 TRX; that is the
 * figure used here, and it is labelled an estimate everywhere it surfaces.
 */
const TRON_SWAP_TRX_ESTIMATE = 5;

/** The bridge refuses anything smaller (see /wduco_wrap in the server source). */
export const MIN_WRAP_DUCO = 50;

/** Below this, a "pool" is a rounding error and quoting from it would be dishonest. */
const MIN_POOL_USD = 5;

/** DEXes whose pairs expose Uniswap-V2 `getReserves()` semantics. */
const V2_STYLE_DEXES = new Set(['pancakeswap', 'biswap', 'apeswap', 'babyswap', 'mdex']);

function pancakeVenue(pair: DexPair): Venue {
  return {
    id: `pancake-${pair.pairAddress}`,
    label: `PancakeSwap · ${pair.quoteToken.symbol}`,
    chain: 'BNB Chain',
    url: `https://pancakeswap.finance/swap?inputCurrency=${BSC_DUCO}&outputCurrency=${pair.quoteToken.address}`,
    route: [
      `Wrap DUCO to bscDUCO (min ${MIN_WRAP_DUCO} DUCO)`,
      `Sell bscDUCO for ${pair.quoteToken.symbol} on PancakeSwap`,
    ],
    kind: 'dex',
  };
}

const SUNSWAP_VENUE: Venue = {
  id: 'sunswap-tron',
  label: 'SunSwap · TRX',
  chain: 'TRON',
  url: `https://sunswap.com/#/v1?tokenAddress=${TRON_WDUCO}`,
  route: [
    `Wrap DUCO to wDUCO on TRON (min ${MIN_WRAP_DUCO} DUCO)`,
    'Sell wDUCO for TRX on SunSwap V1',
  ],
  kind: 'dex',
};

/**
 * Price BSC pools by simulating the sell against live reserves.
 *
 * DexScreener supplies discovery and the quote token's USD price (as
 * priceUsd / priceNative, which is internally consistent); the reserves and
 * therefore the slippage come from the chain.
 */
export async function quoteBscVenues(amount: number, signal?: AbortSignal): Promise<VenueQuote[]> {
  const pairs = (await fetchDexPairs(BSC_DUCO, signal))
    .filter((p) => p.chainId === 'bsc' && (p.liquidity?.usd ?? 0) >= MIN_POOL_USD)
    .filter((p) => p.baseToken.address.toLowerCase() === BSC_DUCO.toLowerCase())
    // Constant-product pools only. DexScreener also lists concentrated-liquidity and
    // bespoke pools whose reserves this model does not describe.
    .filter((p) => V2_STYLE_DEXES.has(p.dexId.toLowerCase()))
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))
    .slice(0, 5);

  if (pairs.length === 0) return [];

  // One batched round trip: reserves + token0 + quote decimals for every pair.
  const calls = pairs.flatMap((pair) => [
    { to: pair.pairAddress, data: SELECTOR.getReserves },
    { to: pair.pairAddress, data: SELECTOR.token0 },
    { to: pair.quoteToken.address, data: SELECTOR.decimals },
  ]);
  const results = await evmBatchCall(calls, signal);

  const gasPrice = await evmGasPriceWei(signal);

  // usdPerQuote for each pair, derived from DexScreener's own two prices so the
  // conversion stays internally consistent with the pair it came from.
  const priced = pairs.flatMap((pair, i) => {
    // A null slot means that call reverted — typically a non-V2 pool. Skip it.
    const reservesHex = results[i * 3] ?? null;
    const token0Hex = results[i * 3 + 1] ?? null;
    const decimalsHex = results[i * 3 + 2] ?? null;
    if (!reservesHex || !token0Hex || !decimalsHex) return [];

    const priceUsd = Number(pair.priceUsd ?? 0);
    const priceNative = Number(pair.priceNative ?? 0);
    const usdPerQuote = priceNative > 0 ? priceUsd / priceNative : 0;
    if (!(usdPerQuote > 0)) return [];

    return [{ pair, reservesHex, token0Hex, decimalsHex, usdPerQuote }];
  });

  /*
    Gas is always paid in BNB, whatever the pair trades against — so the USD gas cost
    can't come from a USDT pair's own quote rate. Take BNB/USD from a WBNB-quoted
    pair and apply it across every BSC venue.
  */
  const bnbUsd = priced.find((p) => /^W?BNB$/i.test(p.pair.quoteToken.symbol))?.usdPerQuote ?? null;
  const gasCostUsd =
    gasPrice !== null && bnbUsd !== null
      ? (Number(gasPrice * SWAP_GAS_UNITS) / 1e18) * bnbUsd
      : null;

  return priced.map(({ pair, reservesHex, token0Hex, decimalsHex, usdPerQuote }): VenueQuote => {
    const ducoIsToken0 = addressWord(token0Hex) === BSC_DUCO.toLowerCase();
    const reserve0 = word(reservesHex, 0);
    const reserve1 = word(reservesHex, 1);
    const reserveDuco = ducoIsToken0 ? reserve0 : reserve1;
    const reserveQuote = ducoIsToken0 ? reserve1 : reserve0;
    const quoteDecimals = Number(word(decimalsHex, 0));

    // bscDUCO is an 18-decimal ERC-20 (verified on-chain), unlike DUCO itself.
    const sim = simulateSell(amount, reserveDuco, reserveQuote, 18, quoteDecimals, PANCAKE_FEE_BPS);
    const grossUsd = sim.amountOut * usdPerQuote;

    return {
      venue: pancakeVenue(pair),
      status: 'ok',
      provenance: 'realisable',
      spotUsd: sim.spotPrice * usdPerQuote,
      effectiveUsd: sim.effectivePrice * usdPerQuote,
      grossUsd,
      costUsd: gasCostUsd,
      // Deliberately not clamped at zero. "Gas costs more than the coins are worth"
      // is a real and common outcome here, and rounding it up to $0.00 would hide
      // the single most useful thing this panel can tell a small holder.
      netUsd: gasCostUsd === null ? null : grossUsd - gasCostUsd,
      priceImpact: sim.priceImpact,
      liquidityUsd: pair.liquidity?.usd ?? null,
    };
  });
}

/**
 * Price the TRON pool.
 *
 * SunSwap V1 pools are plain accounts holding TRX plus the token, so the reserves
 * are just balances. TRX has to be priced externally; without that price the venue
 * still reports, but only as a quote.
 */
export async function quoteSunSwap(amount: number, signal?: AbortSignal): Promise<VenueQuote | null> {
  const [account, trxUsd, decimals] = await Promise.all([
    tronAccount(TRON_SUNSWAP_EXCHANGE, signal),
    fetchTrxUsd(signal),
    tronTokenDecimals(TRON_WDUCO, signal),
  ]);
  if (!account) return null;

  const ducoDecimals = decimals ?? TRON_WDUCO_DECIMALS_FALLBACK;

  const reserveDuco = account.trc20[TRON_WDUCO] ?? 0n;
  const reserveTrx = account.trxSun;
  if (reserveDuco <= 0n || reserveTrx <= 0n) {
    return {
      venue: SUNSWAP_VENUE,
      status: 'dead',
      provenance: 'quoted',
      spotUsd: 0,
      effectiveUsd: 0,
      grossUsd: 0,
      costUsd: null,
      netUsd: null,
      priceImpact: 0,
      liquidityUsd: 0,
      note: 'Pool is empty',
    };
  }

  const sim = simulateSell(
    amount,
    reserveDuco,
    reserveTrx,
    ducoDecimals,
    TRX_DECIMALS,
    SUNSWAP_FEE_BPS,
  );

  if (trxUsd === null) {
    return {
      venue: SUNSWAP_VENUE,
      status: 'unavailable',
      provenance: 'quoted',
      spotUsd: 0,
      effectiveUsd: 0,
      grossUsd: 0,
      costUsd: null,
      netUsd: null,
      priceImpact: sim.priceImpact,
      liquidityUsd: null,
      note: 'Depth read, but no TRX price available to convert it to USD',
    };
  }

  const grossUsd = sim.amountOut * trxUsd;
  const costUsd = TRON_SWAP_TRX_ESTIMATE * trxUsd;
  const trxSide = Number(reserveTrx) / 10 ** TRX_DECIMALS;

  return {
    venue: SUNSWAP_VENUE,
    status: 'ok',
    provenance: 'realisable',
    spotUsd: sim.spotPrice * trxUsd,
    effectiveUsd: sim.effectivePrice * trxUsd,
    grossUsd,
    costUsd,
    // Not clamped — see the equivalent note on the BSC path.
    netUsd: grossUsd - costUsd,
    priceImpact: sim.priceImpact,
    // A constant-product pool's depth is both sides, i.e. twice the quote side.
    liquidityUsd: trxSide * trxUsd * 2,
  };
}

/**
 * Venues the Duino-Coin server prices but that we cannot model depth for — centralised
 * venues with no public order book, and chains with no reachable pool. Reported as
 * quotes so they stay visible without ever masquerading as realisable.
 */
export function quoteReportedVenues(
  prices: Record<string, number>,
  amount: number,
  modelled: Set<string>,
): VenueQuote[] {
  const CATALOG: Record<string, { label: string; chain: string; url: string; kind: 'dex' | 'cex' }> = {
    bitstorage: {
      label: 'Bitstorage',
      chain: 'Centralised exchange',
      url: 'https://bitstorage.finance/',
      kind: 'cex',
    },
    nano: { label: 'Nano', chain: 'Nano', url: 'https://duinocoin.com/', kind: 'cex' },
    ubeswap: {
      label: 'UbeSwap',
      chain: 'Celo',
      url: 'https://app.ubeswap.org/',
      kind: 'dex',
    },
    fluffy: { label: 'FluffySwap', chain: 'Ethereum', url: 'https://duinocoin.com/', kind: 'dex' },
    sushi: { label: 'SushiSwap', chain: 'Polygon', url: 'https://www.sushi.com/swap', kind: 'dex' },
    furim: { label: 'Furim', chain: 'Furim', url: 'https://duinocoin.com/', kind: 'cex' },
    nodes: { label: 'Node-S', chain: 'Node-S', url: 'https://duinocoin.com/', kind: 'cex' },
  };

  const out: VenueQuote[] = [];
  for (const [key, meta] of Object.entries(CATALOG)) {
    if (modelled.has(key)) continue;
    const price = prices[key];
    if (typeof price !== 'number') continue;

    // A zero price is a dead market, not a free one. Shown, but never ranked.
    if (price <= 0) {
      out.push({
        venue: { id: key, label: meta.label, chain: meta.chain, url: meta.url, route: [], kind: meta.kind },
        status: 'dead',
        provenance: 'quoted',
        spotUsd: 0,
        effectiveUsd: 0,
        grossUsd: 0,
        costUsd: null,
        netUsd: null,
        priceImpact: 0,
        liquidityUsd: null,
        note: 'No market',
      });
      continue;
    }

    out.push({
      venue: {
        id: key,
        label: meta.label,
        chain: meta.chain,
        url: meta.url,
        route: [`Trade DUCO on ${meta.label}`],
        kind: meta.kind,
      },
      status: 'ok',
      provenance: 'quoted',
      spotUsd: price,
      effectiveUsd: price,
      grossUsd: price * amount,
      costUsd: null,
      netUsd: null,
      priceImpact: 0,
      liquidityUsd: null,
      note: 'Quoted price only — no depth data, so large amounts may not fill',
    });
  }
  return out;
}
