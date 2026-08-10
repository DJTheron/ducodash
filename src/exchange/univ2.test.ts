import { describe, expect, it } from 'vitest';
import { fromRaw, getAmountOut, simulateSell, toRaw } from './univ2';

describe('getAmountOut', () => {
  it('matches the Uniswap V2 reference calculation', () => {
    // Textbook case: 1000/1000 pool, 1 unit in, 30 bps fee.
    // 997 * 1000 / (1000 * 1000 + 997) = 996006 / 1000997 -> 0 in integer units,
    // so use a scale where the result is non-trivial.
    const out = getAmountOut(10n ** 18n, { in: 1000n * 10n ** 18n, out: 1000n * 10n ** 18n }, 30);
    // 0.996006981039903216 ETH, the canonical V2 answer for this pool.
    expect(fromRaw(out, 18)).toBeCloseTo(0.996006981, 8);
  });

  it('charges less on a 25 bps pool than a 30 bps pool', () => {
    const reserves = { in: 1000n * 10n ** 18n, out: 1000n * 10n ** 18n };
    const cheap = getAmountOut(10n ** 18n, reserves, 25);
    const dear = getAmountOut(10n ** 18n, reserves, 30);
    expect(cheap > dear).toBe(true);
  });

  it('returns nothing for empty pools or non-positive input', () => {
    expect(getAmountOut(0n, { in: 100n, out: 100n }, 25)).toBe(0n);
    expect(getAmountOut(100n, { in: 0n, out: 100n }, 25)).toBe(0n);
    expect(getAmountOut(100n, { in: 100n, out: 0n }, 25)).toBe(0n);
  });

  it('never returns more than the pool holds', () => {
    const reserves = { in: 10n ** 18n, out: 500n * 10n ** 18n };
    const out = getAmountOut(10n ** 30n, reserves, 25);
    expect(out < reserves.out).toBe(true);
  });
});

describe('toRaw / fromRaw', () => {
  it('round-trips without precision loss on large balances', () => {
    expect(fromRaw(toRaw(32_738_670.524, 18), 18)).toBeCloseTo(32_738_670.524, 3);
  });

  it('handles the 6-decimal wDUCO scale', () => {
    expect(toRaw(1, 6)).toBe(10n ** 6n);
    expect(fromRaw(816_577_816_092n, 6)).toBeCloseTo(816_577.816092, 6);
  });

  it('truncates rather than throwing on excess precision', () => {
    expect(toRaw(1.23456789, 2)).toBe(123n);
  });
});

describe('simulateSell', () => {
  /*
    The live SunSwap V1 wDUCO pool, read from TRON on 2026-08-10:
    816,577.816092 wDUCO against 177.511257 TRX, both 6 dp, 30 bps.
    Spot works out at 2.1738e-4 TRX/DUCO, which at the day's TRX price reproduces
    the "Duco SunSwap price" the Duino-Coin server itself publishes — the
    cross-check that pins these constants to reality.
  */
  const RESERVE_DUCO = 816_577_816_092n;
  const RESERVE_TRX = 177_511_257n;
  const DP = 6;

  it('reproduces the spot price implied by real reserves', () => {
    const sim = simulateSell(1, RESERVE_DUCO, RESERVE_TRX, DP, DP, 30);
    expect(sim.spotPrice).toBeCloseTo(2.1738e-4, 8);
  });

  it('shows negligible impact for a small holding', () => {
    const sim = simulateSell(1_000, RESERVE_DUCO, RESERVE_TRX, DP, DP, 30);
    expect(sim.priceImpact).toBeLessThan(0.005);
  });

  it('shows severe impact once the holding rivals the pool', () => {
    // 5M DUCO against an 816k-DUCO pool: most of the notional value is unobtainable.
    const sim = simulateSell(5_000_000, RESERVE_DUCO, RESERVE_TRX, DP, DP, 30);
    expect(sim.priceImpact).toBeGreaterThan(0.8);
    expect(sim.effectivePrice).toBeLessThan(sim.spotPrice);
  });

  it('grows impact monotonically with size', () => {
    const sizes = [100, 1_000, 10_000, 100_000, 1_000_000];
    const impacts = sizes.map(
      (s) => simulateSell(s, RESERVE_DUCO, RESERVE_TRX, DP, DP, 30).priceImpact,
    );
    for (let i = 1; i < impacts.length; i++) {
      expect(impacts[i]!).toBeGreaterThan(impacts[i - 1]!);
    }
  });

  it('is safe on an empty pool', () => {
    const sim = simulateSell(100, 0n, 0n, DP, DP, 30);
    expect(sim.amountOut).toBe(0);
    expect(sim.priceImpact).toBe(0);
  });
});
