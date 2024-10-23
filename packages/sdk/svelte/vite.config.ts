import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    alias: {
      lib: path.resolve(__dirname, 'src/lib'),
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts,svelte}'],
    globals: true,
    environment: 'jsdom',
  },
});
