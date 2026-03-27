import React, { FormEvent, useEffect, useState } from 'react';

import {
  LDContext,
  useBoolVariation,
  useInitializationStatus,
  useLDClient,
} from '@launchdarkly/react-sdk';

import './App.css';

// Set FLAG_KEY to the feature flag key you want to evaluate.
const FLAG_KEY = import.meta.env.LAUNCHDARKLY_FLAG_KEY ?? 'sample-feature';

const PRESET_CONTEXTS: ReadonlyArray<LDContext> = [
  { kind: 'user', key: 'example-user-key', name: 'Sandy' },
  { kind: 'user', key: 'user-jamie', name: 'Jamie' },
  { kind: 'user', key: 'user-alex', name: 'Alex' },
] as const;

function App() {
  const client = useLDClient();
  const { status } = useInitializationStatus();
  const [flagKey, setFlagKey] = useState(FLAG_KEY);
  const [inputValue, setInputValue] = useState(flagKey);
  const flagValue = useBoolVariation(flagKey, false);
  const [activeContextKey, setActiveContextKey] = useState<string | undefined>(
    () => client?.getContext()?.key as string | undefined,
  );
  const [identifyPending, setIdentifyPending] = useState(false);

  useEffect(() => {
    const unsubscribe = client.onContextChange((ctx) => {
      setActiveContextKey(ctx?.key as string | undefined);
    });
    return unsubscribe;
  }, [client]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFlagKey(inputValue.trim() || FLAG_KEY);
  };

  const handleSelectContext = async (preset: LDContext) => {
    setIdentifyPending(true);
    await client.identify(preset);
    setActiveContextKey(preset.key as string);
    setIdentifyPending(false);
  };

  let statusMessage: string;
  if (status === 'complete') {
    statusMessage = 'SDK successfully initialized!';
  } else if (status === 'failed') {
    statusMessage =
      'SDK failed to initialize. Please check your internet connection and SDK credential for any typo.';
  } else {
    statusMessage = 'Initializing…';
  }

  const ready = status !== 'initializing';
  const headerBgColor = ready && flagValue ? '#00844B' : '#373841';

  return (
    <div className="App">
      <header className="App-header" style={{ backgroundColor: headerBgColor }}>
        {ready && (
          <>
            <p>{statusMessage}</p>
            <p>{`The ${flagKey} feature flag evaluates to ${flagValue ? 'true' : 'false'}.`}</p>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Flag key"
                aria-label="Flag key"
              />
              <button type="submit">Update flag</button>
            </form>
            <div style={{ display: 'flex', gap: '8px' }}>
              {PRESET_CONTEXTS.map((preset) => {
                const isActive = activeContextKey === (preset.key as string);
                return (
                  <button
                    key={preset.key as string}
                    onClick={() => handleSelectContext(preset)}
                    disabled={identifyPending}
                    style={{
                      fontWeight: isActive ? 'bold' : 'normal',
                      outline: isActive ? '2px solid white' : 'none',
                    }}
                  >
                    {preset.name as string}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </header>
    </div>
  );
}

export default App;
