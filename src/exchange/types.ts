/**
 * How much we trust a number.
 *
 * The dashboard shows this on every price it prints. A worse-sourced number is
 * never silently substituted for a better one — if depth can't be fetched, the UI
 * says "quoted only", it does not quietly fall back and keep the label.
 */
export type Provenance =
  /** Simulated against live pool reserves for this exact holding. */
  | 'realisable'
  /** A venue's own last-traded price, with no depth information. */
  | 'quoted'
  /** The server's headline "Duco price" — a reference only. */
  | 'nominal';

export type VenueStatus = 'ok' | 'dead' | 'unavailable';

export type Venue = {
  id: string;
  label: string;
  chain: string;
  /** Where a user actually goes to do the trade. */
  url: string;
  /** Human-readable steps to realise the value. */
  route: string[];
  kind: 'dex' | 'cex';
};

export type VenueQuote = {
  venue: Venue;
  status: VenueStatus;
  provenance: Provenance;
  /** USD per DUCO ignoring size. */
  spotUsd: number;
  /** USD per DUCO for the holding being valued. */
  effectiveUsd: number;
  /** Total USD proceeds for the holding, before network costs. */
  grossUsd: number;
  /** Proceeds after estimated network costs; null when costs are unknown. */
  netUsd: number | null;
  /** Estimated network/bridge cost in USD, if modelled. */
  costUsd: number | null;
  priceImpact: number;
  liquidityUsd: number | null;
  /** Set when status is not 'ok'. */
  note?: string;
};

export type ExchangeReport = {
  /** Best venue by net proceeds, or by gross when no costs are modelled. */
  best: VenueQuote | null;
  quotes: VenueQuote[];
  /** The server's headline price, kept for the explicit honest comparison. */
  nominalUsd: number;
  nominalTotalUsd: number;
  /** Fetched at. */
  at: number;
  errors: string[];
};
