import React from 'react';
import ReactDOM from 'react-dom/client';

import {
  createLDReactProvider,
  LDContext,
  LDReactProviderOptions,
} from '@launchdarkly/react-sdk';

import App from './App';
import './index.css';

const LAUNCHDARKLY_CLIENT_SIDE_ID = import.meta.env.LAUNCHDARKLY_CLIENT_SIDE_ID ?? '';

const context: LDContext = {
  // Set up the evaluation context. This context should appear on your LaunchDarkly contexts dashboard soon after you run the demo.
  kind: 'user',
  key: 'example-user-key',
  name: 'Sandy',
};

async function fetchBootstrap(): Promise<Record<string, unknown>> {
  const res = await fetch('/api/bootstrap');
  if (!res.ok) {
    throw new Error(`Bootstrap request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function main() {
  const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

  let bootstrapData: Record<string, unknown>;
  try {
    bootstrapData = await fetchBootstrap();
  } catch (err) {
    root.render(
      <div className="error">
        <p>
          Failed to load bootstrap data from the server. Make sure
          <code> LAUNCHDARKLY_SDK_KEY </code> and <code>LAUNCHDARKLY_CLIENT_SIDE_ID</code> are set,
          then restart the server.
        </p>
        <pre>{err instanceof Error ? err.message : String(err)}</pre>
      </div>,
    );
    return;
  }

  // Pass the server-evaluated payload as `bootstrap` so the client renders real flag values
  // on first paint instead of waiting for the SDK to fetch them.
  const options: LDReactProviderOptions = {
    bootstrap: bootstrapData,
  };
  const LDReactProvider = createLDReactProvider(LAUNCHDARKLY_CLIENT_SIDE_ID, context, options);

  root.render(
    <LDReactProvider>
      <App />
    </LDReactProvider>,
  );
}

main();
