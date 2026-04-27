#!/usr/bin/env node

/* eslint-disable no-console */
import { startAdapter } from '../adapter/startAdapter.js';

function parsePort(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`Invalid port: ${value}`);
    process.exit(1);
  }
  return port;
}

const subcommand = process.argv[2];

if (subcommand === 'adapter') {
  startAdapter({
    restPort: parsePort(process.env.ADAPTER_REST_PORT),
    wsPort: parsePort(process.env.ADAPTER_WS_PORT),
  });
} else {
  console.error(
    subcommand ?
      `Unknown subcommand: ${subcommand}` :
      'Usage: sdk-testharness-server <subcommand>\n\nSubcommands:\n  adapter   Start the REST↔WebSocket adapter',
  );
  process.exit(1);
}
