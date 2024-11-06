import { derived, get, type Readable, readonly, writable, type Writable } from 'svelte/store';

import {
  initialize,
  type LDClient,
  type LDContext,
  type LDFlagSet,
} from '@launchdarkly/js-client-sdk';

/** Client ID for LaunchDarkly */
export type LDClientID = string;

/** Flags for LaunchDarkly */
export type LDFlags = LDFlagSet;

/** Value of LaunchDarkly flags */
export type LDFlagsValue = LDFlagSet[string];

/**
 * Checks if the LaunchDarkly client is initialized.
 * @param {LDClient | undefined} client - The LaunchDarkly client.
 * @throws {Error} If the client is not initialized.
 */
function isClientInitialized(client: LDClient | undefined): asserts client is LDClient {
  if (!client) {
    throw new Error('LaunchDarkly client not initialized');
  }
}

/**
 * Creates a LaunchDarkly instance.
 * @returns {Object} The LaunchDarkly instance object.
 */
function createLD() {
  let jsSdk: LDClient | undefined;
  const loading = writable(true);
  const flagsWritable = writable<LDFlags>({});

  /**
   * Initializes the LaunchDarkly client.
   * @param {LDClientID} clientId - The client ID.
   * @returns {Writable<boolean>} An object with the initialization status store.
   */

  function LDInitialize(clientId: LDClientID) {
    jsSdk = initialize(clientId);
    jsSdk!.on('ready', () => {
      loading.set(false);
      const allFlags = jsSdk!.allFlags();
      flagsWritable.set(allFlags);
    });

    jsSdk!.on('change', () => {
      const allFlags = jsSdk!.allFlags();
      flagsWritable.set(allFlags);
    });

    return {
      initializing: loading,
    };
  }

  /**
   * Identifies the user context.
   * @param {LDContext} context - The user context.
   * @returns {Promise} A promise that resolves when the user is identified.
   */
  async function identify(context: LDContext) {
    isClientInitialized(jsSdk);
    return jsSdk.identify(context);
  }

  /**
   * Watches a flag for changes.
   * @param {string} flagKey - The key of the flag to watch.
   * @returns {Readable<LDFlagsValue>} A readable store of the flag value.
   */
  const watch = (flagKey: string): Readable<LDFlagsValue> =>
    derived<Writable<LDFlags>, LDFlagsValue>(flagsWritable, ($flags) => $flags[flagKey]);

  /**
   * Checks if a flag is on.
   * @param {string} flagKey - The key of the flag to check.
   * @returns {boolean} True if the flag is on, false otherwise.
   */
  const isOn = (flagKey: string): boolean => {
    isClientInitialized(jsSdk);
    const currentFlags = get(flagsWritable);
    return !!currentFlags[flagKey];
  };

  return {
    identify,
    flags: readonly(flagsWritable),
    initialize: LDInitialize,
    initializing: readonly(loading),
    watch,
    isOn,
  };
}

/** The LaunchDarkly instance */
export const LD = createLD();
