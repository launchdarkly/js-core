import {
  AutoEnvAttributes,
  browserFdv1Endpoints,
  Configuration,
  ConnectionMode,
  createDefaultSourceFactoryProvider,
  createFDv2DataManagerBase,
  DESKTOP_DATA_SYSTEM_DEFAULTS,
  DESKTOP_TRANSITION_TABLE,
  FDv2DataManagerControl,
  FlagManager,
  internal,
  LDClientImpl,
  LDClientInternalOptions,
  LDContext,
  LDEmitter,
  LDEmitterEventName,
  LDFlagValue,
  LDHeaders,
  LDIdentifyOptions,
  LDIdentifyResult,
  LDPluginEnvironmentMetadata,
  mobileFdv1Endpoints,
  MODE_TABLE,
  resolveForegroundMode,
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
  // Used only by the FDv1 (NodeDataManager) path. When FDv2 is active,
  // getConnectionMode() delegates to the data manager directly.
  private _connectionMode: ConnectionMode;
  // Serializes FDv2 connection-mode transitions so concurrent calls cannot
  // reorder flush/event-sending around the await in the offline branch.
  private _fdv2ConnectionModeQueue: Promise<void> = Promise.resolve();

  constructor(envKey: string, initialContext: LDContext, options: NodeOptions = {}) {
    const { logger: customLogger, debug } = options;
    const logger = customLogger ?? basicLogger({ level: debug ? 'debug' : 'info' });

    const validatedNodeOptions = validateOptions(options, logger);

    const { useMobileKey } = validatedNodeOptions;

    const internalOptions: LDClientInternalOptions = {
      analyticsEventPath: useMobileKey ? `/mobile` : `/events/bulk/${envKey}`,
      diagnosticEventPath: useMobileKey
        ? `/mobile/events/diagnostic`
        : `/events/diagnostic/${envKey}`,
      highTimeoutThreshold: 15,
      getImplementationHooks: (_environmentMetadata: LDPluginEnvironmentMetadata) =>
        internal.safeGetHooks(logger, _environmentMetadata, validatedNodeOptions.plugins),
      credentialType: useMobileKey ? 'mobileKey' : 'clientSideId',
      requiresStart: true,
      initialContext,
      dataSystemDefaults: DESKTOP_DATA_SYSTEM_DEFAULTS,
    };

    const platform = new NodePlatform(logger, validatedNodeOptions);
    const endpoints = useMobileKey ? mobileFdv1Endpoints() : browserFdv1Endpoints(envKey);

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
      ) => {
        if (configuration.dataSystem) {
          const foregroundMode = resolveForegroundMode(
            configuration.dataSystem,
            DESKTOP_DATA_SYSTEM_DEFAULTS,
          );
          return createFDv2DataManagerBase({
            platform,
            flagManager,
            credential: envKey,
            config: configuration,
            baseHeaders,
            emitter,
            transitionTable: DESKTOP_TRANSITION_TABLE,
            foregroundMode,
            backgroundMode: undefined,
            modeTable: MODE_TABLE,
            sourceFactoryProvider: createDefaultSourceFactoryProvider(),
            fdv1Endpoints: useMobileKey ? mobileFdv1Endpoints() : browserFdv1Endpoints(envKey),
            buildQueryParams: (identifyOptions?: LDIdentifyOptions) => {
              if (useMobileKey) {
                // Mobile mode authenticates via Authorization header, not query params.
                if ((identifyOptions as NodeIdentifyOptions | undefined)?.hash) {
                  logger.warn('[NodeClient] \'hash\' is ignored in mobile key mode.');
                }
                return [];
              }
              const params: { key: string; value: string }[] = [{ key: 'auth', value: envKey }];
              // Per-identify hash overrides the construction-time hash, mirroring FDv1 behavior.
              const hash =
                (identifyOptions as NodeIdentifyOptions | undefined)?.hash ||
                validatedNodeOptions.hash;
              if (hash) {
                params.push({ key: 'h', value: hash });
              }
              return params;
            },
          });
        }
        return new NodeDataManager(
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
        );
      },
      internalOptions,
    );

    this._connectionMode = validatedNodeOptions.initialConnectionMode;
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
    if (this.isFDv2) {
      // FDv2 data manager: serialize transitions so concurrent calls cannot
      // reorder flush/setEventSendingEnabled around the offline await.
      const task = this._fdv2ConnectionModeQueue.then(async () => {
        if (mode === 'offline') {
          await this.flush();
          this.setEventSendingEnabled(false, false);
        }
        (this.dataManager as FDv2DataManagerControl).setConnectionMode(mode);
        if (mode !== 'offline') {
          this.setEventSendingEnabled(true, false);
        }
      });
      this._fdv2ConnectionModeQueue = task.catch(() => {});
      await task;
    } else {
      await (this.dataManager as NodeDataManager).setConnectionMode(
        mode,
        () => this.flush(),
        (enabled) => this.setEventSendingEnabled(enabled, false),
      );
      this._connectionMode = (this.dataManager as NodeDataManager).getConnectionMode();
    }
  }

  getConnectionMode(): ConnectionMode {
    if (this.isFDv2) {
      const mode = (this.dataManager as FDv2DataManagerControl).getCurrentMode();
      // FDv2ConnectionMode is a superset of ConnectionMode (also includes 'one-shot'
      // and 'background'). Map any desktop-only EAP modes to 'streaming' since the
      // data source is actively synchronizing in those states.
      if (mode === 'offline' || mode === 'streaming' || mode === 'polling') {
        return mode;
      }
      return 'streaming';
    }
    return this._connectionMode;
  }

  isOffline(): boolean {
    if (this.isFDv2) {
      return (this.dataManager as FDv2DataManagerControl).getCurrentMode() === 'offline';
    }
    return this._connectionMode === 'offline';
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
