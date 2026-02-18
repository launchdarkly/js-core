import { LDClient, LDFlagsStateOptions } from '@launchdarkly/js-server-sdk-common';

import { LDReactServerClient } from './LDClient';
import { LDReactServerOptions } from './LDOptions';

export type * from './LDContextProvider';
export type * from './LDOptions';
export type * from './LDClient';

/**
 * @experimental
 * This function is experimental and may change in the future.
 *
 * Creates a restricted version of the common server client that is used for server side rendering.
 *
 * @param client The LaunchDarkly client.
 * @param options The options for the React server client.
 * @returns The React server client. The client is a restricted version of the common server client.
 */
export function createReactServerClient(
  client: LDClient,
  options: LDReactServerOptions,
): LDReactServerClient {
  if (!options.contextProvider) {
    throw new Error('contextProvider is required');
  }

  const { contextProvider } = options;
  return {
    variation: (key, defaultValue, callback) => {
      const context = contextProvider.getContext();
      return client.variation(key, context, defaultValue, callback);
    },
    variationDetail: (key, defaultValue, callback) => {
      const context = contextProvider.getContext();
      return client.variationDetail(key, context, defaultValue, callback);
    },
    migrationVariation: (key, defaultValue) => {
      const context = contextProvider.getContext();
      return client.migrationVariation(key, context, defaultValue);
    },
    boolVariation: (key, defaultValue) => {
      const context = contextProvider.getContext();
      return client.boolVariation(key, context, defaultValue);
    },
    numberVariation: (key, defaultValue) => {
      const context = contextProvider.getContext();
      return client.numberVariation(key, context, defaultValue);
    },
    stringVariation: (key, defaultValue) => {
      const context = contextProvider.getContext();
      return client.stringVariation(key, context, defaultValue);
    },
    jsonVariation: (key, defaultValue) => {
      const context = contextProvider.getContext();
      return client.jsonVariation(key, context, defaultValue);
    },
    boolVariationDetail: (key, defaultValue) => {
      const context = contextProvider.getContext();
      return client.boolVariationDetail(key, context, defaultValue);
    },
    numberVariationDetail: (key, defaultValue) => {
      const context = contextProvider.getContext();
      return client.numberVariationDetail(key, context, defaultValue);
    },
    stringVariationDetail: (key, defaultValue) => {
      const context = contextProvider.getContext();
      return client.stringVariationDetail(key, context, defaultValue);
    },
    jsonVariationDetail: (key, defaultValue) => {
      const context = contextProvider.getContext();
      return client.jsonVariationDetail(key, context, defaultValue);
    },
    initialized: () => client.initialized(),
    allFlagsState: (allFlagsStateOptions: LDFlagsStateOptions, callback) => {
      const context = contextProvider.getContext();
      return client.allFlagsState(context, allFlagsStateOptions, callback);
    },
  };
}
