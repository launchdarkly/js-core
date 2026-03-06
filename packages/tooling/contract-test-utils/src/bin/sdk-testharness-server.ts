#!/usr/bin/env node
/* eslint-disable no-console */

import { startAdapter } from '../adapter/startAdapter.js';
import { loadConfig } from './loadConfig.js';

const COMMANDS = ['adapter'] as const;
type Command = (typeof COMMANDS)[number];

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] as Command | undefined;

  if (!command || !COMMANDS.includes(command)) {
    console.error('Usage: sdk-testharness-server <command>');
    console.error(`Commands: ${COMMANDS.join(', ')}`);
    process.exit(1);
  }

  const config = await loadConfig();

  switch (command) {
    case 'adapter':
      startAdapter(config.adapter);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
