import { createRendererClient } from '@launchdarkly/electron-client-sdk/renderer';

import './index.css';

// Injected at build time from LAUNCHDARKLY_FLAG_KEY (see vite.renderer.config.ts).
// eslint-disable-next-line no-underscore-dangle
const flagKey = __LD_FLAG_KEY__;

// Injected at build time from LAUNCHDARKLY_MOBILE_KEY, must match main process.
const launchDarklyBrowserClient = createRendererClient(__LD_CLIENT_SIDE_ID__);

function updateFlagValues() {
  const flagValue = launchDarklyBrowserClient.variation(flagKey, false);
  const el = document.getElementById('flag-value');
  if (el) el.textContent = `The ${flagKey} feature flag evaluates to ${flagValue}.`;
  document.body.style.backgroundColor = flagValue ? '#00844B' : '#373841';
  document.body.style.color = '#FFFFFF';
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
