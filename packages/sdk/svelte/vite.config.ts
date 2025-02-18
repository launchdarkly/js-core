import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      lib: path.resolve(__dirname, 'src/lib'),
    },
  },
  test: {
    include: ['__tests__/**/*.{test,spec}.{js,ts,svelte}'],
    globals: true,
    environment: 'jsdom',
  },
});
