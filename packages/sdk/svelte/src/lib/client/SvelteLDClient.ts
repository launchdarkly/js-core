import { derived, type Readable, readonly, writable, type Writable } from 'svelte/store';

import {
  createClient as createClientSdk,
  type LDClient,
  type LDContext,
  type LDFlagSet,
  type LDFlagValue,
  type LDIdentifyResult,
  type LDOptions,
} from '@launchdarkly/js-client-sdk';

export type { LDContext, LDFlagValue };

/** Client ID for LaunchDarkly */
export type LDClientID = string;

/** Flags for LaunchDarkly */
export type LDFlags = LDFlagSet;

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
function init() {
  let coreLdClient: LDClient | undefined;
  const flagsWritable = writable<LDFlags>({});
  const initializeResult = writable<string>('pending');

  // NOTE: we will returns an empty promise for now as the promise states and handling is being wrappered
  // we can evaluate this decision in the future before this SDK is marked as stable.
  /**
   * Initializes the LaunchDarkly client.
   * @param {LDClientID} clientId - The client ID.
   * @param {LDContext} context - The user context.
   * @returns {Object} An object with the initialization status store.
   */
  function initialize(
    clientId: LDClientID,
    context: LDContext,
    options?: LDOptions,
  ): Promise<void> {
    coreLdClient = createClientSdk(clientId, context, options);

    coreLdClient.on('change', () => {
      const rawFlags = coreLdClient!.allFlags();
      const allFlags = toFlagsProxy(coreLdClient!, rawFlags);
      flagsWritable.set(allFlags);
    });

    // TODO: currently all options are defaulted which means that the client initailization will timeout in 5 seconds.
    // we will need to address this before this SDK is marked as stable.
    coreLdClient.start();

    return coreLdClient
      .waitForInitialization()
      .then((result) => {
        const rawFlags = coreLdClient!.allFlags();
        const allFlags = toFlagsProxy(coreLdClient!, rawFlags);
        flagsWritable.set(allFlags);

        initializeResult.set(result.status);
      })
      .catch(() => {
        // NOTE: this should never happen as we don't throw errors from initialization.
        options?.logger?.error('Failed to initialize LaunchDarkly client');
        initializeResult.set('failed');
      });
  }

  /**
   * Identifies the user context.
   * @param {LDContext} context - The user context.
   * @returns {Promise} A promise that resolves when the user is identified.
   */
  async function identify(context: LDContext): Promise<LDIdentifyResult> {
    isClientInitialized(coreLdClient);
    return coreLdClient.identify(context);
  }

  /**
   * Watches a flag for changes.
   * @param {string} flagKey - The key of the flag to watch.
   * @returns {Readable<LDFlagsValue>} A readable store of the flag value.
   */
  const watch = (flagKey: string): Readable<LDFlagValue> =>
    derived<Writable<LDFlags>, LDFlagValue>(flagsWritable, ($flags) => $flags[flagKey]);

  /**
   * Gets the current value of a flag.
   * @param {string} flagKey - The key of the flag to get.
   * @param {TFlag} defaultValue - The default value of the flag.
   * @returns {TFlag} The current value of the flag.
   */
  function useFlag<TFlag extends LDFlagValue>(flagKey: string, defaultValue: TFlag): TFlag {
    isClientInitialized(coreLdClient);
    return coreLdClient.variation(flagKey, defaultValue);
  }

  return {
    identify,
    flags: readonly(flagsWritable),
    initialize,
    initalizationState: readonly(initializeResult),
    watch,
    useFlag,
  };
}

/** The LaunchDarkly instance */
export const LD = init();
