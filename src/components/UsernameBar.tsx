import { useEffect, useState } from 'react';
import { formatRelative } from '../lib/format';

export function UsernameBar({
  username,
  onSubmit,
  refreshing,
  lastUpdated,
  onRefresh,
}: {
  username: string;
  onSubmit: (value: string) => void;
  refreshing: boolean;
  lastUpdated: number | null;
  onRefresh: () => void;
}) {
  const [draft, setDraft] = useState(username);
  useEffect(() => setDraft(username), [username]);

  // Re-render on a timer so "updated 40 seconds ago" doesn't sit there going stale.
  const [, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="sticky top-0 z-30 border-b border-rule bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <a href="./" className="font-display text-lg leading-none text-ink">
          ducodash
        </a>

        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = draft.trim();
            if (value) onSubmit(value);
          }}
        >
          <label htmlFor="username" className="sr-only">
            Duino-Coin username
          </label>
          <input
            id="username"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck={false}
            autoCapitalize="none"
            autoComplete="username"
            placeholder="Duino-Coin username"
            className="w-full max-w-56 rounded-full border border-rule bg-paper-card px-3.5 py-1.5 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            className="shrink-0 whitespace-nowrap rounded-full bg-ink px-3.5 py-1.5 text-sm font-medium text-paper transition hover:bg-accent"
          >
            Look up
          </button>
        </form>

        <button
          type="button"
          onClick={onRefresh}
          className="text-xs text-ink-muted transition hover:text-ink"
          title="Refresh now"
        >
          {refreshing
            ? 'Refreshing…'
            : lastUpdated
              ? `Updated ${formatRelative(new Date(lastUpdated))}`
              : 'Refresh'}
        </button>
      </div>
    </div>
  );
}
