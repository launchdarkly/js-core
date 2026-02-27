#!/usr/bin/env node

/**
 * Opens the Electron app and keeps it running until the process is terminated.
 * Run from the entity directory after building (e.g. after running start:debug once).
 *
 * Usage: node open-electron.mjs
 */

const { _electron: electron } = await import('playwright');

console.log('Launching Electron app...');

let close = null;

const lifetimePromise = new Promise((resolve) => {
  close = resolve;
});

const electronApp = await electron.launch({
  args: ['.vite/build/main.js'],
  cwd: process.cwd(),
});

console.log('Electron contract test entity is running. Press Ctrl+C to close.');

electronApp.on('close', () => {
  close();
});

await lifetimePromise;
