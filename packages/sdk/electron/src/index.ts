import type {
  LDContext,
  LDEmitterEventName,
  LDFlagValue,
} from '@launchdarkly/js-client-sdk-common';

import { ElectronClient } from './ElectronClient';
import type { ElectronIdentifyOptions } from './ElectronIdentifyOptions';
import type { ElectronOptions, LDProxyOptions, LDTLSOptions } from './ElectronOptions';
import type { LDClient, LDStartOptions } from './LDClient';
import type { LDPlugin } from './LDPlugin';

export * from '@launchdarkly/js-client-sdk-common';

export type {
  ElectronIdentifyOptions,
  ElectronOptions as LDOptions,
  LDClient,
  LDPlugin,
  LDProxyOptions,
  LDStartOptions,
  LDTLSOptions,
};

/**
 * Builds the LaunchDarkly client facade (PIMPL). Exposes a single identify method that returns
 * identify results. Plugins are registered with the facade.
 */
function makeClient(
  credential: string,
  initialContext: LDContext,
  options: ElectronOptions = {},
): LDClient {
  const impl = new ElectronClient(credential, initialContext, options);

  const client: LDClient = {
    variation: (key: string, defaultValue?: LDFlagValue) => impl.variation(key, defaultValue),
    variationDetail: (key: string, defaultValue?: LDFlagValue) =>
      impl.variationDetail(key, defaultValue),
    boolVariation: (key: string, defaultValue: boolean) => impl.boolVariation(key, defaultValue),
    boolVariationDetail: (key: string, defaultValue: boolean) =>
      impl.boolVariationDetail(key, defaultValue),
    numberVariation: (key: string, defaultValue: number) => impl.numberVariation(key, defaultValue),
    numberVariationDetail: (key: string, defaultValue: number) =>
      impl.numberVariationDetail(key, defaultValue),
    stringVariation: (key: string, defaultValue: string) => impl.stringVariation(key, defaultValue),
    stringVariationDetail: (key: string, defaultValue: string) =>
      impl.stringVariationDetail(key, defaultValue),
    jsonVariation: (key: string, defaultValue: unknown) => impl.jsonVariation(key, defaultValue),
    jsonVariationDetail: (key: string, defaultValue: unknown) =>
      impl.jsonVariationDetail(key, defaultValue),
    track: (key: string, data?: unknown, metricValue?: number) =>
      impl.track(key, data, metricValue),
    on: (key: string, callback: (...args: unknown[]) => void) =>
      impl.on(key as LDEmitterEventName, callback as (...args: unknown[]) => void),
    off: (key: string, callback: (...args: unknown[]) => void) =>
      impl.off(key as LDEmitterEventName, callback as (...args: unknown[]) => void),
    flush: () => impl.flush(),
    identify: (ctx: LDContext, identifyOptions?: ElectronIdentifyOptions) =>
      impl.identifyResult(ctx, identifyOptions),
    getContext: () => impl.getContext(),
    close: () => impl.close(),
    allFlags: () => impl.allFlags(),
    addHook: (hook: Parameters<LDClient['addHook']>[0]) => impl.addHook(hook),
    waitForInitialization: (waitOptions?: Parameters<LDClient['waitForInitialization']>[0]) =>
      impl.waitForInitialization(waitOptions),
    logger: impl.logger,
    start: (startOptions?: LDStartOptions) => impl.start(startOptions),
    setConnectionMode: (mode: Parameters<LDClient['setConnectionMode']>[0]) =>
      impl.setConnectionMode(mode),
    getConnectionMode: () => impl.getConnectionMode(),
    isOffline: () => impl.isOffline(),
  };

  impl.registerPluginsWith(client);

  return client;
}

/**
 * Creates the LaunchDarkly client in the Electron main process. The client is not ready until
 * {@link LDClient.start} is called.
 *
 * @param credential The LaunchDarkly mobile key, or client-side ID when options.useClientSideId is true.
 * @param initialContext The initial context used for the first identify when start() is called.
 * @param options Optional configuration.
 * @returns The client instance. Call client.start() before using variations or identify() for context changes.
 * The returned client's identify() resolves to an {@link LDIdentifyResult} and does not throw.
 */
export function createClient(
  credential: string,
  initialContext: LDContext,
  options: ElectronOptions = {},
): LDClient {
  return makeClient(credential, initialContext, options);
}
