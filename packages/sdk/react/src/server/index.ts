import {
  LDClient,
  type LDEvaluationDetail,
  type LDEvaluationDetailTyped,
  type LDFlagsState,
  type LDFlagsStateOptions,
} from '@launchdarkly/js-server-sdk-common';

import { LDReactServerClient } from './LDClient';
import { LDReactServerOptions } from './LDOptions';

export type * from './LDContextProvider';
export type * from './LDOptions';
export type * from './LDClient';

const CLIENT_SIDE_REASON = { kind: 'ERROR' as const, errorKind: 'CLIENT_NOT_READY' };

function makeNoOpDetail<T>(value: T): LDEvaluationDetail & { value: T } {
  return {
    value,
    variationIndex: null,
    reason: CLIENT_SIDE_REASON,
  };
}

function makeNoOpFlagsState(): LDFlagsState {
  return {
    valid: false,
    getFlagValue: () => null,
    getFlagReason: () => null,
    allValues: () => ({}),
    toJSON: () => ({ $flagsState: {}, $valid: false }),
  };
}

/**
 * Returns true when code is running in a server environment (e.g. Node), false when running in the
 * browser or other client environment.
 */
export function isServer(): boolean {
  return typeof window === 'undefined';
}

/**
 * @returns A no-op client that returns default values and does not call the underlying LaunchDarkly client.
 * This is useful when dealing with applications that are using React Server Components.
 *
 * This fallback is helpful when compilers attempt to prerender components on build time.
 * This will enable the components to at least be prerendered with their default values.
 */
function makeNoOpClient(): LDReactServerClient {
  return {
    variation: (key, defaultValue, callback) => {
      const result = Promise.resolve(defaultValue);
      if (callback) {
        result.then((res) => callback(null, res)).catch((err) => callback(err, defaultValue));
      }
      return result;
    },
    variationDetail: (key, defaultValue, callback) => {
      const detail = makeNoOpDetail(defaultValue);
      const result = Promise.resolve(detail);
      if (callback) {
        result.then((res) => callback(null, res)).catch((err) => callback(err, detail));
      }
      return result;
    },
    boolVariation: (key, defaultValue) => Promise.resolve(defaultValue),
    numberVariation: (key, defaultValue) => Promise.resolve(defaultValue),
    stringVariation: (key, defaultValue) => Promise.resolve(defaultValue),
    jsonVariation: (key, defaultValue) => Promise.resolve(defaultValue),
    boolVariationDetail: (key, defaultValue) =>
      Promise.resolve(makeNoOpDetail(defaultValue) as LDEvaluationDetailTyped<boolean>),
    numberVariationDetail: (key, defaultValue) =>
      Promise.resolve(makeNoOpDetail(defaultValue) as LDEvaluationDetailTyped<number>),
    stringVariationDetail: (key, defaultValue) =>
      Promise.resolve(makeNoOpDetail(defaultValue) as LDEvaluationDetailTyped<string>),
    jsonVariationDetail: (key, defaultValue) =>
      Promise.resolve(makeNoOpDetail(defaultValue) as LDEvaluationDetailTyped<unknown>),
    initialized: () => false,
    allFlagsState: (allFlagsStateOptions, callback) => {
      const state = makeNoOpFlagsState();
      const result = Promise.resolve(state);
      if (callback) {
        result.then((res) => callback(null, res)).catch((err) => callback(err, null));
      }
      return result;
    },
  };
}

/**
 * @experimental
 * This function is experimental and may change in the future.
 *
 * Creates a restricted version of the common server client that is used for server side rendering.
 * When not running on the server (e.g. in the browser), returns a no-op client that returns default
 * values and does not call the underlying LaunchDarkly client.
 *
 * @param client The LaunchDarkly client.
 * @param options The options for the React server client.
 * @returns The React server client. The client is a restricted version of the common server client.
 */
export function createReactServerClient(
  client: LDClient,
  options: LDReactServerOptions,
): LDReactServerClient {
  if (!isServer()) {
    return makeNoOpClient();
  }

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
