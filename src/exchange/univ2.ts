/*
  Constant-product AMM math.

  Integer arithmetic on BigInt raw token units, matching what the pair contract
  actually executes — floating point here would drift from the real swap result,
  which defeats the point of computing this at all.

  Applies unchanged to PancakeSwap V2 (25 bps) and SunSwap/JustSwap V1 (30 bps);
  both are Uniswap-V2-shaped.
*/

export type Reserves = { in: bigint; out: bigint };

/** Uniswap V2 `getAmountOut`. Returns raw output units. */
export function getAmountOut(amountIn: bigint, reserves: Reserves, feeBps: number): bigint {
  if (amountIn <= 0n || reserves.in <= 0n || reserves.out <= 0n) return 0n;

  const feeMultiplier = BigInt(10_000 - feeBps);
  const amountInWithFee = amountIn * feeMultiplier;
  const numerator = amountInWithFee * reserves.out;
  const denominator = reserves.in * 10_000n + amountInWithFee;
  return numerator / denominator;
}

export function toRaw(amount: number, decimals: number): bigint {
  if (!Number.isFinite(amount) || amount <= 0) return 0n;
  // Via a fixed-point string so large balances don't lose precision through
  // Number -> BigInt conversion.
  const [whole = '0', frac = ''] = amount.toFixed(decimals).split('.');
  return BigInt(whole + frac.padEnd(decimals, '0').slice(0, decimals));
}

export function fromRaw(raw: bigint, decimals: number): number {
  if (decimals === 0) return Number(raw);
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const remainder = raw % divisor;
  return Number(whole) + Number(remainder) / Number(divisor);
}

export type SwapResult = {
  /** Output in quote-token units. */
  amountOut: number;
  /** Output per input unit at this size — the rate you actually get. */
  effectivePrice: number;
  /** Rate at infinitesimal size — the rate naive dashboards quote. */
  spotPrice: number;
  /** Fraction of value lost to depth, 0..1. The gap between the two prices above. */
  priceImpact: number;
};

/**
 * Simulate selling `amountIn` of the base token into a pool.
 *
 * The whole point: `spotPrice` is what a headline price feed reports, and
 * `effectivePrice` is what the pool will actually pay for *this* size. On a pool
 * with a hundred dollars of depth those differ by an order of magnitude for any
 * meaningful holding.
 */
export function simulateSell(
  amountIn: number,
  reserveIn: bigint,
  reserveOut: bigint,
  decimalsIn: number,
  decimalsOut: number,
  feeBps: number,
): SwapResult {
  const spotPrice =
    reserveIn > 0n
      ? fromRaw(reserveOut, decimalsOut) / fromRaw(reserveIn, decimalsIn)
      : 0;

  const rawIn = toRaw(amountIn, decimalsIn);
  const rawOut = getAmountOut(rawIn, { in: reserveIn, out: reserveOut }, feeBps);
  const amountOut = fromRaw(rawOut, decimalsOut);
  const effectivePrice = amountIn > 0 ? amountOut / amountIn : 0;

  return {
    amountOut,
    effectivePrice,
    spotPrice,
    priceImpact: spotPrice > 0 ? Math.max(0, 1 - effectivePrice / spotPrice) : 0,
  };
}
