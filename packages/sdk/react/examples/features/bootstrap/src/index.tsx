import React from 'react';
import ReactDOM from 'react-dom/client';

import {
  createLDReactProvider,
  LDContext,
  LDReactProviderOptions,
} from '@launchdarkly/react-sdk';

import App from './App';
import './index.css';

declare global {
  interface Window {
    __LD_BOOTSTRAP__?: Record<string, unknown>;
    __LD_CLIENT_SIDE_ID__?: string;
    __LD_CONTEXT__?: LDContext;
  }
}

// eslint-disable-next-line no-underscore-dangle
const bootstrapData = window.__LD_BOOTSTRAP__;
// eslint-disable-next-line no-underscore-dangle
const clientSideId = window.__LD_CLIENT_SIDE_ID__ ?? '';
// eslint-disable-next-line no-underscore-dangle
const context = window.__LD_CONTEXT__;

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

if (!bootstrapData || !context) {
  root.render(
    <div className="error">
      <p>
        Bootstrap data was not injected by the server. Make sure
        <code> LAUNCHDARKLY_SDK_KEY </code> and <code>LAUNCHDARKLY_CLIENT_SIDE_ID</code> are set,
        then restart the server.
      </p>
    </div>,
  );
} else {
  // Pass the server-evaluated payload as `bootstrap` so the client renders real flag values
  // on first paint instead of waiting for the SDK to fetch them.
  const options: LDReactProviderOptions = { bootstrap: bootstrapData };
  const LDReactProvider = createLDReactProvider(clientSideId, context, options);

  root.render(
    <LDReactProvider>
      <App />
    </LDReactProvider>,
  );
}
