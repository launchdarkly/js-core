import { createRendererClient } from '@launchdarkly/electron-client-sdk/renderer';

import './index.css';

const flagKey = 'sample-feature';

// Injected at build time from LD_CLIENT_SIDE_ID, must match main process.
const launchDarklyBrowserClient = createRendererClient(__LD_CLIENT_SIDE_ID__);

function updateFlagValues() {
  const flagsAndValues = launchDarklyBrowserClient.allFlags();
  const el = document.getElementById('flag-value');
  if (el) el.textContent = flagsAndValues[flagKey]?.toString() ?? 'N/A';
}

(async () => {
  // eslint-disable-next-line no-console
  console.log('👋 This message is being logged by "renderer.ts", included via Vite');

  await launchDarklyBrowserClient.waitForInitialization({ timeout: 5000 });

  // eslint-disable-next-line no-console
  console.log('waitForInitialization complete');
  // Listening for the "change" event allows us to receive flag changes at any time.
  launchDarklyBrowserClient.on('change', () => {
    // eslint-disable-next-line no-console
    console.log('change event received');
    updateFlagValues();
  });

  updateFlagValues();
})();
