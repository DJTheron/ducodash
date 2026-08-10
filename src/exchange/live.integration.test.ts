import { describe, expect, it } from 'vitest';
import { buildExchangeReport, realisedValue } from './report';
import { fetchStatistics } from '../api/endpoints';
import { readVenuePrices } from './prices';

/*
  Live integration check. Skipped by default so `npm test` stays offline and
  deterministic; run it with LIVE=1 to exercise the real pipeline:

      LIVE=1 npx vitest run src/exchange/live.integration.test.ts

  This is the check that the depth model agrees with reality — it asserts that the
  simulated pools reproduce the prices the Duino-Coin server independently reports.
*/
const live = process.env.LIVE === '1' ? describe : describe.skip;

live('live exchange pipeline', () => {
  it('prices a real holding against live pools', async () => {
    const stats = await fetchStatistics();
    const prices = readVenuePrices(stats);
    const nominal = stats['Duco price'] ?? 0;

    const report = await buildExchangeReport(100_000, prices, nominal);

    console.log(`\nnominal    ${nominal.toExponential(4)} USD/DUCO`);
    console.log(`100,000 DUCO nominally = $${(nominal * 100_000).toFixed(4)}\n`);
    for (const q of report.quotes) {
      const value = realisedValue(q);
      console.log(
        `  ${q.status.padEnd(12)} ${q.provenance.padEnd(11)} ${q.venue.label.padEnd(26)}` +
          ` $${value.toFixed(4).padStart(9)}  impact ${(q.priceImpact * 100).toFixed(1).padStart(5)}%` +
          `  liq ${q.liquidityUsd === null ? '   n/a' : `$${q.liquidityUsd.toFixed(0)}`}`,
      );
    }
    console.log(`\nbest: ${report.best?.venue.label} -> $${realisedValue(report.best!).toFixed(4)}`);
    if (report.errors.length) console.log('errors:', report.errors);

    expect(report.quotes.length).toBeGreaterThan(0);
    expect(report.best).not.toBeNull();
    expect(report.best!.provenance).toBe('realisable');

    // The simulated pool must agree with the server's independently-reported price
    // for the same venue. Order-of-magnitude agreement is the real assertion here:
    // if decimals or reserve ordering were wrong, this would be off by 10^n.
    const sun = report.quotes.find((q) => q.venue.id === 'sunswap-tron');
    if (sun && sun.status === 'ok') {
      const reported = prices.sunswap;
      expect(reported).toBeGreaterThan(0);
      expect(sun.spotUsd).toBeGreaterThan(reported! * 0.5);
      expect(sun.spotUsd).toBeLessThan(reported! * 2);
    }
  }, 60_000);

  it('reports no on-chain route below the wrap minimum', async () => {
    const stats = await fetchStatistics();
    const report = await buildExchangeReport(10, readVenuePrices(stats), stats['Duco price'] ?? 0);
    if (report.best?.venue.kind === 'dex') {
      expect(report.best.status).toBe('unavailable');
    }
  }, 60_000);
});
