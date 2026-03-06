/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { ContractTestConfig } from '../types/ContractTestConfig.js';

const CONFIG_BASE = 'contract-test.config';
const EXTENSIONS = ['.json', '.js', '.mjs', '.cjs', '.ts', '.mts'];

/**
 * Loads a contract test configuration file from the current working directory.
 * Searches for `contract-test.config.{json,js,mjs,cjs,ts,mts}` in order.
 *
 * - `.json` files are parsed with JSON.parse
 * - `.js`, `.mjs`, `.cjs`, `.ts`, `.mts` files are loaded via dynamic import
 *   (TypeScript files require Node.js >= 22 or a loader like tsx)
 *
 * If no config file is found, returns an empty config (defaults will be used).
 */
export async function loadConfig(cwd: string = process.cwd()): Promise<ContractTestConfig> {
  for (const ext of EXTENSIONS) {
    const filePath = path.join(cwd, `${CONFIG_BASE}${ext}`);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    console.log(`Loading config from ${CONFIG_BASE}${ext}`);

    if (ext === '.json') {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as ContractTestConfig;
    }

    // For JS/TS files, use dynamic import
    const module = await import(pathToFileURL(filePath).href);
    return (module.default ?? module) as ContractTestConfig;
  }

  // No config file found — use defaults
  return {};
}
