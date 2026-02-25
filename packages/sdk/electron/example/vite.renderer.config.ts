/* eslint-disable import/no-extraneous-dependencies */
import { defineConfig } from 'vite';

// LD_CLIENT_SIDE_ID from the environment is inlined into the renderer bundle at build time.
const launchDarklyClientId = process.env.LD_MOBILE_KEY ?? 'example-client-id';

// https://vitejs.dev/config
export default defineConfig({
  define: {
    __LD_CLIENT_SIDE_ID__: JSON.stringify(launchDarklyClientId),
  },
});
