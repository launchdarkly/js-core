import { useState } from 'react';

import {
  useBoolVariation,
  useInitializationStatus,
  useLDClient,
} from '@launchdarkly/react-sdk';
import type { FDv2ConnectionMode, LDContext } from '@launchdarkly/react-sdk';

import './App.css';

// Set FLAG_KEY to the feature flag key you want to evaluate.
const FLAG_KEY = import.meta.env.LAUNCHDARKLY_FLAG_KEY ?? 'sample-feature';

// FDv2 connection modes the data system can use.
const CONNECTION_MODES: FDv2ConnectionMode[] = [
  'streaming',
  'polling',
  'offline',
  'one-shot',
  'background',
];

const CONTEXTS: LDContext[] = [
  { kind: 'user', key: 'example-user-key', name: 'Sandy' },
  { kind: 'user', key: 'example-user-key-2', name: 'Alex' },
];

function App() {
  const { status } = useInitializationStatus();
  const flagValue = useBoolVariation(FLAG_KEY, false);
  const ldc = useLDClient();

  const [mode, setMode] = useState<string>('automatic');
  const [streaming, setStreaming] = useState<string>('default');
  const [contextIndex, setContextIndex] = useState(0);
  const [log, setLog] = useState<string[]>([]);

  const addLog = (line: string) =>
    setLog((prev) => [`${new Date().toISOString().slice(11, 23)}  ${line}`, ...prev].slice(0, 25));

  const onSetConnectionMode = (next?: FDv2ConnectionMode) => {
    ldc.setConnectionMode(next);
    setMode(next ?? 'automatic');
    addLog(`setConnectionMode(${next ?? 'undefined'})`);
  };

  const onSetStreaming = (next?: boolean) => {
    ldc.setStreaming(next);
    setStreaming(next === undefined ? 'default' : String(next));
    addLog(`setStreaming(${next === undefined ? 'undefined' : next})`);
  };

  const onSwitchContext = async () => {
    const next = (contextIndex + 1) % CONTEXTS.length;
    setContextIndex(next);
    addLog(`identify(${JSON.stringify(CONTEXTS[next])})`);
    const result = await ldc.identify(CONTEXTS[next]);
    addLog(`identify result: ${result.status}`);
  };

  const ready = status !== 'initializing';
  let statusMessage = 'Initializing…';
  if (status === 'complete') {
    statusMessage = 'SDK successfully initialized.';
  } else if (status === 'failed') {
    statusMessage = 'SDK failed to initialize. Check your client-side ID and network.';
  }

  return (
    <div className="App">
      <h1>LaunchDarkly React FDv2 Demo</h1>
      <p className="status">{statusMessage}</p>

      <section>
        <h2>Flag</h2>
        <p>
          <code>{FLAG_KEY}</code> = <strong>{ready ? String(flagValue) : '…'}</strong>
        </p>
      </section>

      <section>
        <h2>Connection mode</h2>
        <p>
          Current: <strong>{mode}</strong>
        </p>
        <div className="buttons">
          {CONNECTION_MODES.map((m) => (
            <button key={m} onClick={() => onSetConnectionMode(m)}>
              {m}
            </button>
          ))}
          <button onClick={() => onSetConnectionMode(undefined)}>automatic (clear)</button>
        </div>
      </section>

      <section>
        <h2>Streaming</h2>
        <p>
          Current: <strong>{streaming}</strong>
        </p>
        <div className="buttons">
          <button onClick={() => onSetStreaming(true)}>setStreaming(true)</button>
          <button onClick={() => onSetStreaming(false)}>setStreaming(false)</button>
          <button onClick={() => onSetStreaming(undefined)}>setStreaming(undefined)</button>
        </div>
      </section>

      <section>
        <h2>Context</h2>
        <p>
          Current: <code>{JSON.stringify(CONTEXTS[contextIndex])}</code>
        </p>
        <div className="buttons">
          <button onClick={onSwitchContext}>Switch context (identify)</button>
        </div>
      </section>

      <section>
        <h2>Log</h2>
        <pre className="log">{log.join('\n')}</pre>
      </section>
    </div>
  );
}

export default App;
