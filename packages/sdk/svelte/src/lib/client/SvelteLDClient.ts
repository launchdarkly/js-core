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
 * Creates a proxy for the given flags object that intercepts access to flag values.
 * When a flag value is accessed, it checks if the flag key exists in the target object.
 * If the flag key exists, it returns the variation of the flag from the client.
 * Otherwise, it returns the current value of the flag.
 *
 * @param client - The LaunchDarkly client instance used to get flag variations.
 * @param flags - The initial flags object to be proxied.
 * @returns A proxy object that intercepts access to flag values and returns the appropriate variation.
 */
function toFlagsProxy(client: LDClient, flags: LDFlags): LDFlags {
  return new Proxy(flags, {
    get(target, prop, receiver) {
      const currentValue = Reflect.get(target, prop, receiver);
      // only process flag keys and ignore symbols and native Object functions
      if (typeof prop === 'symbol') {
        return currentValue;
      }

      // check if flag key exists
      const validFlagKey = Object.hasOwn(target, prop);

      if (!validFlagKey) {
        return currentValue;
      }

      return client.variation(prop, currentValue);
    },
  });
}

/**
 * Creates a LaunchDarkly instance.
 * @returns {Object} The LaunchDarkly instance object.
 */
function createLD() {
  let coreLdClient: LDClient | undefined;
  const loading = writable(true);
  const flagsWritable = writable<LDFlags>({});

  /**
   * Initializes the LaunchDarkly client.
   * @param {LDClientID} clientId - The client ID.
   * @returns {Writable<boolean>} An object with the initialization status store.
   */

  function LDInitialize(clientId: LDClientID) {
    coreLdClient = initialize(clientId);
    coreLdClient!.on('ready', () => {
      loading.set(false);
      const rawFlags = coreLdClient!.allFlags();
      const allFlags = toFlagsProxy(coreLdClient, rawFlags);
      flagsWritable.set(allFlags);
    });

    coreLdClient!.on('change', () => {
      const rawFlags = coreLdClient!.allFlags();
      const allFlags = toFlagsProxy(coreLdClient, rawFlags);
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
    isClientInitialized(coreLdClient);
    return coreLdClient.identify(context);
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
    isClientInitialized(coreLdClient);
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
