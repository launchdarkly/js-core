/* eslint-disable import/no-extraneous-dependencies */
import { defineConfig } from 'vite';

// LAUNCHDARKLY_MOBILE_KEY from the environment is inlined into the renderer bundle at build time.
const launchDarklyClientId = process.env.LAUNCHDARKLY_MOBILE_KEY ?? 'example-client-id';

const launchDarklyFlagKey = process.env.LAUNCHDARKLY_FLAG_KEY ?? 'sample-feature';

// https://vitejs.dev/config
export default defineConfig({
  define: {
    __LD_CLIENT_SIDE_ID__: JSON.stringify(launchDarklyClientId),
    __LD_FLAG_KEY__: JSON.stringify(launchDarklyFlagKey),
  },
});
