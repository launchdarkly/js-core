'use client';

import { useCallback, useEffect, useState } from 'react';

interface FlagState {
  flagKey: string;
  flagValue: boolean;
}

export default function FlagDisplay({ initialState }: { initialState?: FlagState }) {
  const [state, setState] = useState<FlagState | null>(initialState ?? null);
  const [error, setError] = useState<string | null>(null);

  const fetchFlag = useCallback(async () => {
    try {
      const res = await fetch('/api/flag');
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      // Only update state when the flag value actually changed to avoid
      // unnecessary re-renders during polling.
      setState((prev) => {
        if (prev && prev.flagKey === data.flagKey && prev.flagValue === data.flagValue) {
          return prev;
        }
        return { flagKey: data.flagKey, flagValue: data.flagValue };
      });
      setError(null);
    } catch (e) {
      setError(`Failed to fetch flag: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  useEffect(() => {
    fetchFlag();

    // Poll every 2 seconds to pick up flag changes.
    const interval = setInterval(fetchFlag, 2000);
    return () => clearInterval(interval);
  }, [fetchFlag]);

  if (error) {
    return (
      <div className="app app--off">
        <p>{error}</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="app app--off">
        <p>Initializing...</p>
      </div>
    );
  }

  return (
    <div className={`app ${state.flagValue ? 'app--on' : 'app--off'}`}>
      <p>
        The {state.flagKey} feature flag evaluates to {String(state.flagValue)}.
      </p>
    </div>
  );
}
