import React, { useState, FormEvent, useContext, useEffect } from 'react';
import logo from './logo.svg';
import './App.css';
import { LDContext, LDContextStrict, LDReactClientContextValue, LDReactContext } from '@launchdarkly/react-sdk';

// Set FLAG_KEY to the feature flag key you want to evaluate.
const FLAG_KEY = 'sample-feature';

const PRESET_CONTEXTS: ReadonlyArray<LDContextStrict> = [
  { kind: 'user', key: 'example-user-key', name: 'Sandy' },
  { kind: 'user', key: 'user-jamie', name: 'Jamie' },
  { kind: 'user', key: 'user-alex', name: 'Alex' },
] as const;

function App() {
  // NOTE: we will change this later to use the useLDClient hook instead.
  const { client, context, initializedState } = useContext<LDReactClientContextValue>(LDReactContext);
  const [flagKey, setFlagKey] = useState(FLAG_KEY);
  const [inputValue, setInputValue] = useState(flagKey);
  const [flagValue, setFlagValue] = useState(false);
  const [identifyPending, setIdentifyPending] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFlagKey(inputValue.trim() || FLAG_KEY);
  };

  const handleSelectContext = async (preset: LDContextStrict) => {
    setIdentifyPending(true);
    await client.identify(preset);
    setIdentifyPending(false);
  };

  useEffect(() => {
    const changeHandler = (_context: LDContext) => {
      setFlagValue(client.variation(flagKey, false));
    };
    client.on(`change:${flagKey}`, changeHandler);
    setFlagValue(client.variation(flagKey, false));
    return () => {
      client.off(`change:${flagKey}`, changeHandler);
    };
  }, [flagKey, client]);

  let statusMessage: string;
  if (initializedState === 'complete') {
    statusMessage = 'SDK successfully initialized!';
  } else if (initializedState === 'failed') {
    statusMessage = 'SDK failed to initialize. Please check your internet connection and SDK credential for any typo.';
  } else {
    statusMessage = 'Initializing…';
  }

  const headerBgColor = flagValue ? '#00844B' : '#373841';

  return (
    <div className="App">
      <header className="App-header" style={{ backgroundColor: headerBgColor }}>
        <img src={logo} className="App-logo" alt="logo" />
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
            const isActive = context?.key === preset.key;
            return (
              <button
                key={preset.key}
                onClick={() => handleSelectContext(preset)}
                disabled={identifyPending}
                style={{ fontWeight: isActive ? 'bold' : 'normal', outline: isActive ? '2px solid white' : 'none' }}
              >
                {preset.name}
              </button>
            );
          })}
        </div>
      </header>
    </div>
  );
}

export default App;
