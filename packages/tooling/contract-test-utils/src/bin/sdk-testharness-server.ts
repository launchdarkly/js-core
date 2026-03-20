#!/usr/bin/env node

/* eslint-disable no-console */
import { startAdapter } from '../adapter/startAdapter.js';

const subcommand = process.argv[2];

if (subcommand === 'adapter') {
  const restPort = process.env.ADAPTER_REST_PORT
    ? Number(process.env.ADAPTER_REST_PORT)
    : undefined;
  const wsPort = process.env.ADAPTER_WS_PORT ? Number(process.env.ADAPTER_WS_PORT) : undefined;
  startAdapter({ restPort, wsPort });
} else {
  console.error(
    subcommand
      ? `Unknown subcommand: ${subcommand}`
      : 'Usage: sdk-testharness-server <subcommand>\n\nSubcommands:\n  adapter   Start the REST↔WebSocket adapter',
  );
  process.exit(1);
}
