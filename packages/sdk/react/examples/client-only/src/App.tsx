import React, { useState, FormEvent, useContext, useEffect } from 'react';
import logo from './logo.svg';
import './App.css';
import { LDContext, LDContextStrict, LDReactClientContextValue, LDReactContext } from '@launchdarkly/react-sdk';

const PRESET_CONTEXTS: ReadonlyArray<LDContextStrict> = [
  { kind: 'user', key: 'user-sandy', name: 'Sandy' },
  { kind: 'user', key: 'user-jamie', name: 'Jamie' },
  { kind: 'user', key: 'user-alex', name: 'Alex' },
] as const;

function App() {
  // NOTE: we will change this later to use the useLDClient hook instead.
  const { client, context, initializedState } = useContext<LDReactClientContextValue>(LDReactContext);
  const [flagKey, setFlagKey] = useState('sample-feature');
  const [inputValue, setInputValue] = useState(flagKey);
  const [isOn, setIsOn] = useState(false);
  const [identifyPending, setIdentifyPending] = useState(false);

  console.log('Initialization state:', initializedState);
  console.log('Current context:', context);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFlagKey(inputValue.trim() || 'sample-feature');
  };

  const handleSelectContext = async (preset: LDContextStrict) => {
    setIdentifyPending(true);
    await client.identify(preset);
    setIdentifyPending(false);
  };

  useEffect(() => {
    const changeHandler = (_context: LDContext) => {
      const value = client.variation(flagKey, false)
      setIsOn(value);
    };
    client.on(`change:${flagKey}`, changeHandler);
    // NOTE: client.start() is no longer called here — the Provider handles it automatically.
    return () => {
      client.off(`change:${flagKey}`, changeHandler);
    };
  }, [flagKey, client]);


  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Status: <strong>{initializedState}</strong>
        </p>
        <p>
          Context: <strong>{context ? JSON.stringify(context) : 'none'}</strong>
        </p>
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
        <p>
          <strong>{flagKey}</strong> is {isOn ? <b>on</b> : <b>off</b>}
        </p>
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
        <a className="App-link" href="https://reactjs.org" target="_blank" rel="noopener noreferrer">
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
