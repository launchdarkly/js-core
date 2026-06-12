import {
  AutoEnvAttributes,
  browserFdv1Endpoints,
  Configuration,
  ConnectionMode,
  FlagManager,
  internal,
  LDClientImpl,
  LDClientInternalOptions,
  LDContext,
  LDEmitter,
  LDEmitterEventName,
  LDFlagValue,
  LDHeaders,
  LDIdentifyResult,
  LDPluginEnvironmentMetadata,
} from '@launchdarkly/js-client-sdk-common';

import basicLogger from './basicLogger';
import type { LDClient, LDStartOptions } from './LDClient';
import type { LDPlugin } from './LDPlugin';
import NodeDataManager from './NodeDataManager';
import type { NodeIdentifyOptions } from './NodeIdentifyOptions';
import type { NodeOptions } from './NodeOptions';
import validateOptions, { filterToBaseOptions } from './options';
import NodePlatform from './platform/NodePlatform';

export class NodeClient extends LDClientImpl {
  private readonly _plugins: LDPlugin[];

  constructor(envKey: string, initialContext: LDContext, options: NodeOptions = {}) {
    const { logger: customLogger, debug } = options;
    const logger = customLogger ?? basicLogger({ level: debug ? 'debug' : 'info' });

    const validatedNodeOptions = validateOptions(options, logger);

    const internalOptions: LDClientInternalOptions = {
      analyticsEventPath: `/events/bulk/${envKey}`,
      diagnosticEventPath: `/events/diagnostic/${envKey}`,
      highTimeoutThreshold: 15,
      getImplementationHooks: (_environmentMetadata: LDPluginEnvironmentMetadata) =>
        internal.safeGetHooks(logger, _environmentMetadata, validatedNodeOptions.plugins),
      credentialType: 'clientSideId',
      requiresStart: true,
      initialContext,
    };

    const platform = new NodePlatform(logger, validatedNodeOptions);
    const endpoints = browserFdv1Endpoints(envKey);

    super(
      envKey,
      AutoEnvAttributes.Disabled,
      platform,
      { ...filterToBaseOptions(options), logger },
      (
        flagManager: FlagManager,
        configuration: Configuration,
        baseHeaders: LDHeaders,
        emitter: LDEmitter,
        diagnosticsManager?: internal.DiagnosticsManager,
      ) =>
        new NodeDataManager(
          platform,
          flagManager,
          envKey,
          configuration,
          validatedNodeOptions,
          endpoints.polling,
          endpoints.streaming,
          baseHeaders,
          emitter,
          diagnosticsManager,
        ),
      internalOptions,
    );

    this._plugins = validatedNodeOptions.plugins;
    this.setEventSendingEnabled(!this.isOffline(), false);
  }

  /**
   * Registers plugins with the public client facade so plugins receive the
   * public API (single identify that returns LDIdentifyResult).
   */
  registerPluginsWith(client: LDClient): void {
    internal.safeRegisterPlugins(this.logger, this.environmentMetadata, client, this._plugins);
  }

  override async identifyResult(
    context: LDContext,
    identifyOptions?: NodeIdentifyOptions,
  ): Promise<LDIdentifyResult> {
    const options: NodeIdentifyOptions =
      identifyOptions?.sheddable === undefined
        ? { ...identifyOptions, sheddable: true }
        : identifyOptions;
    return super.identifyResult(context, options);
  }

  async setConnectionMode(mode: ConnectionMode): Promise<void> {
    const dataManager = this.dataManager as NodeDataManager;
    await dataManager.setConnectionMode(
      mode,
      () => this.flush(),
      (enabled) => this.setEventSendingEnabled(enabled, false),
    );
  }

  getConnectionMode(): ConnectionMode {
    const dataManager = this.dataManager as NodeDataManager;
    return dataManager.getConnectionMode();
  }

  isOffline(): boolean {
    const dataManager = this.dataManager as NodeDataManager;
    return dataManager.getConnectionMode() === 'offline';
  }
}

/**
 * Builds the LaunchDarkly client facade (PIMPL). Exposes a single identify
 * method that returns identify results.
 */
export function makeClient(
  envKey: string,
  initialContext: LDContext,
  options: NodeOptions = {},
): LDClient {
  const impl = new NodeClient(envKey, initialContext, options);

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
    identify: (ctx: LDContext, identifyOptions?: NodeIdentifyOptions) =>
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
