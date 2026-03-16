#!/usr/bin/env node

/**
 * Opens a headless browser and navigates to the contract test entity page.
 * Keeps the browser open until the process is terminated.
 *
 * Usage: node open-browser.mjs [url]
 * Default URL: http://localhost:8002
 */

import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:8002';

console.log(`Opening headless browser at ${url}...`);

let close = null;

const lifetimePromise = new Promise((resolve) => {
  close = resolve;
});

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

// Retry page.goto until the entity is ready (race-condition guard)
const maxRetries = 15;
const retryDelayMs = 2000;
for (let attempt = 1; attempt <= maxRetries; attempt++) {
  try {
    await page.goto(url);
    break;
  } catch (err) {
    if (attempt === maxRetries) throw err;
    console.log(`[Browser] Connection to ${url} failed (attempt ${attempt}/${maxRetries}), retrying in ${retryDelayMs}ms...`);
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }
}

console.log('Browser is open and running. Press Ctrl+C to close.');

// Handle termination signals - close browser gracefully
const shutdown = async () => {
  await browser.close();
  close();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Keep the process alive
await lifetimePromise;
