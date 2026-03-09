import type { AdapterOptions } from '../adapter/startAdapter.js';

/**
 * Configuration for the contract test tooling.
 * Can be specified in a `contract-test.config.{json,js,mjs,ts,mts}` file.
 */
export interface ContractTestConfig {
  /** Configuration for the adapter command. */
  adapter?: AdapterOptions;
}
