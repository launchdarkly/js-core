import type {
  LDContext,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDFlagValue,
} from '@launchdarkly/js-client-sdk';
import { createClient as createBrowserClient } from './client/LDReactClient';
import type { LDReactServerClient } from './server/LDClient';
import { isClientSide, isServerSide, NOOP_EVALUATION_REASON } from './shared/utils';
import type { LDIsomorphicClient } from './LDIsomorphicClient';
import type { LDIsomorphicOptions } from './LDIsomorphicOptions';

function noopDetail<T>(defaultValue: T): { value: T; reason: typeof NOOP_EVALUATION_REASON } {
  return { value: defaultValue, reason: NOOP_EVALUATION_REASON };
}

/**
 * Creates an isomorphic LaunchDarkly client that delegates to the browser client
 * on the client and to a federated server client on the server, or no-ops on the
 * server when no server client is set.
 *
 * @internal
 */
export function createIsomorphicClient(
  clientSideID: string,
  context: LDContext,
  options?: LDIsomorphicOptions,
): LDIsomorphicClient {
  const _client = createBrowserClient(clientSideID, context, options);
  let _serverClient: LDReactServerClient | null = null;

  const proxy: LDIsomorphicClient = {
    useServerClient(serverClient: LDReactServerClient): LDIsomorphicClient {
      _serverClient = serverClient;
      return proxy;
    },

    variation(key: string, defaultValue?: LDFlagValue): Promise<LDFlagValue> {
      const def = defaultValue ?? null;
      if (isClientSide()) return Promise.resolve(_client.variation(key, def));
      if (isServerSide() && _serverClient) return _serverClient.variation(key, def ?? undefined);
      return Promise.resolve(def);
    },

    variationDetail(key: string, defaultValue: LDFlagValue): Promise<LDEvaluationDetail> {
      const def = defaultValue ?? null;
      if (isClientSide()) return Promise.resolve(_client.variationDetail(key, def));
      if (isServerSide() && _serverClient) return _serverClient.variationDetail(key, def);
      return Promise.resolve({
        value: def,
        variationIndex: null,
        reason: NOOP_EVALUATION_REASON,
      });
    },

    boolVariation(key: string, defaultValue: boolean): Promise<boolean> {
      if (isClientSide()) return Promise.resolve(_client.boolVariation(key, defaultValue));
      if (isServerSide() && _serverClient) return _serverClient.boolVariation(key, defaultValue);
      return Promise.resolve(defaultValue);
    },

    boolVariationDetail(
      key: string,
      defaultValue: boolean,
    ): Promise<LDEvaluationDetailTyped<boolean>> {
      if (isClientSide()) return Promise.resolve(_client.boolVariationDetail(key, defaultValue));
      if (isServerSide() && _serverClient) {
        return _serverClient.boolVariationDetail(key, defaultValue);
      }
      return Promise.resolve(noopDetail(defaultValue) as LDEvaluationDetailTyped<boolean>);
    },

    numberVariation(key: string, defaultValue: number): Promise<number> {
      if (isClientSide()) return Promise.resolve(_client.numberVariation(key, defaultValue));
      if (isServerSide() && _serverClient) return _serverClient.numberVariation(key, defaultValue);
      return Promise.resolve(defaultValue);
    },

    numberVariationDetail(
      key: string,
      defaultValue: number,
    ): Promise<LDEvaluationDetailTyped<number>> {
      if (isClientSide()) return Promise.resolve(_client.numberVariationDetail(key, defaultValue));
      if (isServerSide() && _serverClient) {
        return _serverClient.numberVariationDetail(key, defaultValue);
      }
      return Promise.resolve(noopDetail(defaultValue) as LDEvaluationDetailTyped<number>);
    },

    stringVariation(key: string, defaultValue: string): Promise<string> {
      if (isClientSide()) return Promise.resolve(_client.stringVariation(key, defaultValue));
      if (isServerSide() && _serverClient) return _serverClient.stringVariation(key, defaultValue);
      return Promise.resolve(defaultValue);
    },

    stringVariationDetail(
      key: string,
      defaultValue: string,
    ): Promise<LDEvaluationDetailTyped<string>> {
      if (isClientSide()) return Promise.resolve(_client.stringVariationDetail(key, defaultValue));
      if (isServerSide() && _serverClient) {
        return _serverClient.stringVariationDetail(key, defaultValue);
      }
      return Promise.resolve(noopDetail(defaultValue) as LDEvaluationDetailTyped<string>);
    },

    jsonVariation(key: string, defaultValue: unknown): Promise<unknown> {
      if (isClientSide()) return Promise.resolve(_client.jsonVariation(key, defaultValue));
      if (isServerSide() && _serverClient) return _serverClient.jsonVariation(key, defaultValue);
      return Promise.resolve(defaultValue);
    },

    jsonVariationDetail(
      key: string,
      defaultValue: unknown,
    ): Promise<LDEvaluationDetailTyped<unknown>> {
      if (isClientSide()) return Promise.resolve(_client.jsonVariationDetail(key, defaultValue));
      if (isServerSide() && _serverClient) {
        return _serverClient.jsonVariationDetail(key, defaultValue);
      }
      return Promise.resolve(noopDetail(defaultValue) as LDEvaluationDetailTyped<unknown>);
    },

    allFlags() {
      if (isClientSide()) return _client.allFlags();
      return {};
    },

    getContext() {
      if (isClientSide()) return _client.getContext();
      return undefined;
    },

    getInitializationState() {
      if (isClientSide()) return _client.getInitializationState();
      if (isServerSide() && _serverClient) {
        return _serverClient.initialized() ? 'completed' : 'unknown';
      }
      return 'unknown';
    },

    identify(ctx: LDContext, identifyOptions?: unknown) {
      if (isClientSide()) return _client.identify(ctx, identifyOptions as any);
      return Promise.resolve();
    },

    flush() {
      if (isClientSide()) return _client.flush();
      return Promise.resolve({ result: true });
    },

    track(key: string, data?: unknown, metricValue?: number) {
      if (isClientSide()) _client.track(key, data, metricValue);
    },

    on(key: string, callback: (...args: unknown[]) => void) {
      if (isClientSide()) _client.on(key, callback as any);
    },

    off(key: string, callback: (...args: unknown[]) => void) {
      if (isClientSide()) _client.off(key, callback as any);
    },

    close() {
      return _client.close();
    },

    start(options?: unknown) {
      if (isClientSide()) return _client.start(options as any);
      return Promise.resolve({ status: 'complete' as const });
    },

    get logger() {
      return _client.logger;
    },
  };

  return proxy;
}
