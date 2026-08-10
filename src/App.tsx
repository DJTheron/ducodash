import { useMemo, useState } from 'react';
import { BalanceHero } from './components/hero/BalanceHero';
import { RealisableValue } from './components/exchange/RealisableValue';
import { MinerFleet } from './components/miners/MinerFleet';
import { StatsGrid } from './components/stats/StatsGrid';
import { ChartsPanel } from './components/charts/ChartsPanel';
import { TransactionFeed } from './components/TransactionFeed';
import { NetworkPanel } from './components/NetworkPanel';
import { UsernameBar } from './components/UsernameBar';
import { realisedValue } from './exchange/report';
import { summariseFleet } from './miners/classify';
import {
  DEMO_USER,
  isMockMode,
  persistUsername,
  readInitialUsername,
  useDashboard,
  useHashrateHistory,
} from './lib/useDashboard';

export default function App() {
  const [username, setUsername] = useState(readInitialUsername);
  const state = useDashboard(username);
  const miners = state.user?.miners ?? [];
  const hashHistory = useHashrateHistory(miners);
  const fleet = useMemo(() => summariseFleet(miners), [miners]);

  const changeUser = (value: string) => {
    persistUsername(value);
    setUsername(value);
  };

  const realisable = state.exchange?.best ? realisedValue(state.exchange.best) : null;

  return (
    <>
      <UsernameBar
        username={username}
        onSubmit={changeUser}
        refreshing={state.refreshing}
        lastUpdated={state.lastUpdated}
        onRefresh={state.refresh}
      />

      {isMockMode(username) && (
        <div className="border-b border-rule bg-accent-soft/60 px-4 py-2 text-center text-xs text-ink">
          Demo data — enter a real Duino-Coin username above to see a live account.
        </div>
      )}

      {state.loading && !state.user ? (
        <LoadingState />
      ) : state.error && !state.user ? (
        <ErrorState username={username} message={state.error} onDemo={() => changeUser(DEMO_USER)} />
      ) : state.user ? (
        <main>
          <BalanceHero
            username={state.user.balance.username}
            balance={state.user.balance.balance}
            verified={state.user.balance.verified === 'yes'}
            stale={state.error !== null}
          />

          <RealisableValue report={state.exchange} balance={state.user.balance.balance} />

          <MinerFleet miners={miners} history={hashHistory} />

          {state.wallet && (
            <StatsGrid
              wallet={state.wallet}
              balance={state.user.balance}
              fleet={fleet}
              realisableUsd={realisable}
            />
          )}

          <ChartsPanel prices={state.historicPrices} wallet={state.wallet} />

          {state.wallet && <TransactionFeed transactions={state.wallet.transactions} />}

          {state.statistics && <NetworkPanel statistics={state.statistics} />}

          <Footer />
        </main>
      ) : null}
    </>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4">
      <div className="h-2 w-2 animate-ping rounded-full bg-accent" />
      <p className="text-sm text-ink-muted">Reading the chain…</p>
    </div>
  );
}

function ErrorState({
  username,
  message,
  onDemo,
}: {
  username: string;
  message: string;
  onDemo: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="font-display text-3xl text-ink">Nothing found</h1>
      <p className="text-sm text-ink-2">
        Couldn't load <strong className="font-semibold">{username}</strong>. {message}
      </p>
      <p className="text-xs text-ink-muted">
        Duino-Coin usernames are case-sensitive. Check the spelling, or the server may be
        briefly unreachable.
      </p>
      <button
        type="button"
        onClick={onDemo}
        className="mt-1 rounded-full border border-rule bg-paper-card px-4 py-2 text-sm font-medium text-ink transition hover:border-accent"
      >
        Show the demo account
      </button>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mx-auto max-w-6xl px-4 pb-16 pt-4 text-xs leading-relaxed text-ink-muted">
      <p>
        Read-only. ducodash never asks for your password and cannot move your coins — every
        figure here comes from public endpoints.
      </p>
      <p className="mt-1.5">
        Prices are modelled against live pool reserves; network fees are estimates, and nothing
        here is financial advice. Data from{' '}
        <a
          className="underline decoration-rule underline-offset-2 hover:text-ink"
          href="https://server.duinocoin.com/statistics"
          target="_blank"
          rel="noreferrer noopener"
        >
          the Duino-Coin API
        </a>
        , DexScreener, and public BNB Chain and TRON nodes.
      </p>
      <p className="mt-1.5">
        <a
          className="underline decoration-rule underline-offset-2 hover:text-ink"
          href="https://github.com/DJTheron/ducodash"
          target="_blank"
          rel="noreferrer noopener"
        >
          Source on GitHub
        </a>{' '}
        · AGPL-3.0
      </p>
    </footer>
  );
}
