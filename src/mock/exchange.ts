import { simulateSell } from '../exchange/univ2';
import type { ExchangeReport, VenueQuote } from '../exchange/types';
import { quoteReportedVenues } from '../exchange/venues';

/*
  A deterministic exchange report for the demo account.

  Built by running the real `simulateSell` against pool reserves captured from
  TRON and BNB Chain on 2026-08-10, so the demo exercises the actual depth model
  and shows the numbers those pools would genuinely produce — it is not a
  hand-written set of pretty figures.

  Reserves as read that day:
    SunSwap V1   816,577.816092 wDUCO  /  177.511257 TRX   (both 6 dp, 30 bps)
    PancakeSwap  4,400,372.275 bscDUCO /  0.08457848 WBNB  (both 18 dp, 25 bps)
*/
const TRX_USD = 0.330708;
const BNB_USD = 599.77;

const SUN_DUCO = 816_577_816_092n;
const SUN_TRX = 177_511_257n;
const CAKE_DUCO = 4_400_372_275_000_000_000_000_000n;
const CAKE_BNB = 84_578_489_729_270_840n;

export function mockExchangeReport(amount: number, prices: Record<string, number>): ExchangeReport {
  const sun = simulateSell(amount, SUN_DUCO, SUN_TRX, 6, 6, 30);
  const cake = simulateSell(amount, CAKE_DUCO, CAKE_BNB, 18, 18, 25);

  const sunGross = sun.amountOut * TRX_USD;
  const sunCost = 5 * TRX_USD;
  const cakeGross = cake.amountOut * BNB_USD;
  const cakeCost = 0.0003 * BNB_USD;

  const quotes: VenueQuote[] = [
    {
      venue: {
        id: 'sunswap-tron',
        label: 'SunSwap · TRX',
        chain: 'TRON',
        url: 'https://sunswap.com/#/v1?tokenAddress=TWYaXdxA12JywrUdou3PFD1fvx2PWjqK9U',
        route: [
          'Wrap DUCO to wDUCO on TRON (min 50 DUCO)',
          'Sell wDUCO for TRX on SunSwap V1',
        ],
        kind: 'dex',
      },
      status: 'ok',
      provenance: 'realisable',
      spotUsd: sun.spotPrice * TRX_USD,
      effectiveUsd: sun.effectivePrice * TRX_USD,
      grossUsd: sunGross,
      costUsd: sunCost,
      netUsd: sunGross - sunCost,
      priceImpact: sun.priceImpact,
      liquidityUsd: (Number(SUN_TRX) / 1e6) * TRX_USD * 2,
    },
    {
      venue: {
        id: 'pancake-demo',
        label: 'PancakeSwap · WBNB',
        chain: 'BNB Chain',
        url: 'https://pancakeswap.finance/swap?inputCurrency=0xCF572cA0AB84d8Ce1652b175e930292E2320785b',
        route: [
          'Wrap DUCO to bscDUCO (min 50 DUCO)',
          'Sell bscDUCO for WBNB on PancakeSwap',
        ],
        kind: 'dex',
      },
      status: 'ok',
      provenance: 'realisable',
      spotUsd: cake.spotPrice * BNB_USD,
      effectiveUsd: cake.effectivePrice * BNB_USD,
      grossUsd: cakeGross,
      costUsd: cakeCost,
      netUsd: cakeGross - cakeCost,
      priceImpact: cake.priceImpact,
      liquidityUsd: (Number(CAKE_BNB) / 1e18) * BNB_USD * 2,
    },
    ...quoteReportedVenues(prices, amount, new Set(['pancake', 'sunswap'])),
  ];

  const tradeable = quotes.filter((q) => q.status === 'ok' && q.grossUsd > 0);
  const realisable = tradeable.filter((q) => q.provenance === 'realisable');
  const best = realisable.reduce(
    (a, b) => ((b.netUsd ?? b.grossUsd) > (a.netUsd ?? a.grossUsd) ? b : a),
    realisable[0]!,
  );

  quotes.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'ok' ? -1 : 1;
    return (b.netUsd ?? b.grossUsd) - (a.netUsd ?? a.grossUsd);
  });

  const nominalUsd = prices.max ?? 7.19e-5;
  return {
    best,
    quotes,
    nominalUsd,
    nominalTotalUsd: nominalUsd * amount,
    at: Date.now(),
    errors: [],
  };
}
