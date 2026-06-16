// eslint-disable-next-line import/no-extraneous-dependencies
import react from '@vitejs/plugin-react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Only expose client-safe LaunchDarkly env vars. Do NOT add `LAUNCHDARKLY_` as a broad prefix --
  // that would bake `LAUNCHDARKLY_SDK_KEY` (a server-side secret) into the client bundle.
  envPrefix: ['VITE_', 'LAUNCHDARKLY_CLIENT_SIDE_ID', 'LAUNCHDARKLY_FLAG_KEY'],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
