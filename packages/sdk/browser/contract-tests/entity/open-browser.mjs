#!/usr/bin/env node

/**
 * Opens a headless browser and navigates to the contract test entity page.
 * Keeps the browser open until the process is terminated.
 *
 * Usage: node open-browser.mjs [url]
 * Default URL: http://localhost:5173
 */

import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5173';

console.log(`Opening headless browser at ${url}...`);

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const context = await browser.newContext();
const page = await context.newPage();

// Log console messages from the browser
page.on('console', (msg) => {
  console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
});

// Log page errors
page.on('pageerror', (error) => {
  console.error(`[Browser Error] ${error.message}`);
});

await page.goto(url);

console.log('Browser is open and running. Press Ctrl+C to close.');

// Keep the process alive
await new Promise(() => {
  // Intentionally never resolve - keeps browser open until process is killed
});
