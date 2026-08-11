import type { Balance } from '../../api/schema';
import {
  formatCompact,
  formatDate,
  formatDuco,
  formatHashrate,
  formatPercent,
  formatRelative,
  formatUsd,
} from '../../lib/format';
import type { FleetSummary } from '../../miners/classify';
import type { WalletStats } from '../../stats/derive';
import { Section, StatTile } from '../Section';
import { FlowBar } from './FlowBar';

function daysBetween(from: Date | null, to = new Date()): number | null {
  if (!from) return null;
  return Math.max(0, Math.floor((to.getTime() - from.getTime()) / 86_400_000));
}

export function StatsGrid({
  wallet,
  balance,
  fleet,
  realisableUsd,
}: {
  wallet: WalletStats;
  balance: Balance;
  fleet: FleetSummary;
  realisableUsd: number | null;
}) {
  const age = daysBetween(wallet.accountAge);
  const { flows } = wallet;

  // Lifetime mining throughput, averaged over the account's life. A rough rate, but
  // the only per-day mining figure the API makes derivable at all.
  const minedPerDay = age && age > 0 ? flows.mined / age : null;

  const staked = balance.stake_amount ?? 0;
  const stakeDate = balance.stake_date ? new Date(balance.stake_date * 1000) : null;
  const stakeMature = stakeDate && stakeDate.getTime() > Date.now() ? stakeDate : null;

  const top = wallet.topCounterparties[0];

  return (
    <Section
      title="Where it came from"
      subtitle="Mining income is derived: the server credits it straight to the balance, so it never appears as a transaction."
    >
      <FlowBar flows={flows} />

      <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Mined"
          value={`${formatDuco(flows.mined, 0)}`}
          hint={
            minedPerDay
              ? `About ${formatDuco(minedPerDay, 1)} DUCO/day over ${formatCompact(age!)} days`
              : 'Derived from the balance minus all transfers'
          }
        />
        <StatTile
          label="Net transfers"
          value={`${wallet.netFlow >= 0 ? '+' : ''}${formatDuco(wallet.netFlow, 0)}`}
          hint={`${formatDuco(flows.totalIn, 0)} in · ${formatDuco(flows.totalOut, 0)} out`}
        />
        <StatTile
          label="Transactions"
          value={formatCompact(wallet.txCount)}
          hint={
            wallet.firstActivity
              ? `First on ${formatDate(wallet.firstActivity)}`
              : 'No transfers recorded'
          }
        />
        <StatTile
          label="Account age"
          value={age === null ? '—' : `${formatCompact(age)}d`}
          hint={wallet.accountAge ? `Created ${formatDate(wallet.accountAge)}` : undefined}
        />

        <StatTile
          label="Fleet hashrate"
          value={formatHashrate(fleet.hashrate)}
          hint={`${fleet.count} ${fleet.count === 1 ? 'rig' : 'rigs'} across ${fleet.pools.length || 1} pool${fleet.pools.length === 1 ? '' : 's'}`}
        />
        <StatTile
          label="Shares accepted"
          value={formatCompact(fleet.accepted)}
          hint={`${formatPercent(fleet.acceptRate, 2)} accept rate · ${formatCompact(fleet.rejected)} rejected`}
        />
        <StatTile
          label="Largest received"
          value={wallet.largestReceived ? formatDuco(wallet.largestReceived.amount, 0) : '—'}
          hint={wallet.largestReceived ? `from ${wallet.largestReceived.counterparty}` : undefined}
        />
        <StatTile
          label="Largest sent"
          value={wallet.largestSent ? formatDuco(wallet.largestSent.amount, 0) : '—'}
          hint={wallet.largestSent ? `to ${wallet.largestSent.counterparty}` : undefined}
        />

        <StatTile
          label="Staked"
          value={staked > 0 ? formatDuco(staked, 0) : '—'}
          hint={
            stakeMature
              ? `Matures ${formatRelative(stakeMature)} · ${formatDate(stakeMature)}`
              : staked > 0
                ? 'Ready to unstake'
                : 'Nothing staked'
          }
          tone={staked > 0 ? 'default' : 'muted'}
        />
        <StatTile
          label="Top counterparty"
          value={top ? top.name : '—'}
          hint={
            top
              ? `${top.count} transfer${top.count === 1 ? '' : 's'} · ${formatDuco(top.received + top.sent, 0)} DUCO`
              : undefined
          }
        />
        <StatTile
          label="Realisable value"
          value={realisableUsd === null ? '—' : formatUsd(realisableUsd)}
          hint="After slippage and estimated network fees on the best verified route"
        />
        <StatTile
          label="Last activity"
          value={wallet.lastActivity ? formatRelative(wallet.lastActivity) : '—'}
          hint={wallet.lastActivity ? formatDate(wallet.lastActivity) : undefined}
          tone="muted"
        />
      </dl>
    </Section>
  );
}
