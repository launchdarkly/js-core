import type {
  EvaluationContext,
  Hook,
  JsonValue,
  Paradigm,
  Provider,
  ProviderMetadata,
  ResolutionDetails,
  TrackingEventDetails,
} from '@openfeature/server-sdk';
import {
  ErrorCode,
  OpenFeatureEventEmitter,
  ProviderEvents,
  StandardResolutionReasons,
} from '@openfeature/server-sdk';

import type { LDLogger } from '@launchdarkly/js-sdk-common';

import type { OpenFeatureLDClientContract } from './OpenFeatureLDClientContract';
import { translateContext } from './translateContext';
import { translateResult } from './translateResult';
import { translateTrackingEventDetails } from './translateTrackingEventDetails';

/**
 * Create a ResolutionDetails for an evaluation that produced a type different
 * than the expected type.
 */
function wrongTypeResult<T>(value: T): ResolutionDetails<T> {
  return {
    value,
    reason: StandardResolutionReasons.ERROR,
    errorCode: ErrorCode.TYPE_MISMATCH,
  };
}

/**
 * Configuration for constructing a {@link BaseOpenFeatureProvider}.
 */
export interface BaseProviderConfig {
  /** The logger to use for diagnostics. */
  logger: LDLogger;
  /** The provider name reported in OpenFeature metadata. */
  providerName: string;
  /** The default timeout in seconds for waitForInitialization. Defaults to 10. */
  initTimeoutSeconds?: number;
}

/**
 * Base OpenFeature provider for LaunchDarkly server-side SDKs.
 *
 * Subclasses must:
 * 1. Construct or receive an LDClient and pass it to {@link setClient} in their constructor.
 * 2. Optionally wire SDK-specific events by calling {@link emitConfigurationChanged}.
 */
export abstract class BaseOpenFeatureProvider<
  TClient extends OpenFeatureLDClientContract = OpenFeatureLDClientContract,
> implements Provider {
  readonly metadata: ProviderMetadata;

  readonly runsOn: Paradigm = 'server';

  readonly events = new OpenFeatureEventEmitter();

  private _client?: TClient;

  private _clientConstructionError?: unknown;

  private _logger: LDLogger;

  private _initTimeoutSeconds: number;

  protected constructor(config: BaseProviderConfig) {
    this.metadata = { name: config.providerName };
    this._logger = config.logger;
    this._initTimeoutSeconds = config.initTimeoutSeconds ?? 10;
  }

  /**
   * Called by subclass constructors to register the LDClient instance.
   */
  protected setClient(client: TClient): void {
    this._client = client;
  }

  /**
   * Called by subclass constructors when client construction throws.
   * The error will be re-thrown from {@link initialize}.
   */
  protected setClientError(error: unknown): void {
    this._clientConstructionError = error;
    this._logger.error(`Encountered unrecoverable initialization error, ${error}`);
  }

  /**
   * Emit an OpenFeature ConfigurationChanged event for the given flag key.
   * Per-SDK providers call this from their event wiring.
   */
  protected emitConfigurationChanged(flagKey: string): void {
    this.events.emit(ProviderEvents.ConfigurationChanged, {
      flagsChanged: [flagKey],
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async initialize(context?: EvaluationContext): Promise<void> {
    if (!this._client) {
      if (this._clientConstructionError) {
        throw this._clientConstructionError;
      }
      throw new Error('Unknown problem encountered during initialization');
    }
    await this._client.waitForInitialization({ timeout: this._initTimeoutSeconds });
  }

  async resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<boolean>> {
    const res = await this._client!.variationDetail(
      flagKey,
      translateContext(this._logger, context),
      defaultValue,
    );
    if (typeof res.value === 'boolean') {
      return translateResult(res);
    }
    return wrongTypeResult(defaultValue);
  }

  async resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<string>> {
    const res = await this._client!.variationDetail(
      flagKey,
      translateContext(this._logger, context),
      defaultValue,
    );
    if (typeof res.value === 'string') {
      return translateResult(res);
    }
    return wrongTypeResult(defaultValue);
  }

  async resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<number>> {
    const res = await this._client!.variationDetail(
      flagKey,
      translateContext(this._logger, context),
      defaultValue,
    );
    if (typeof res.value === 'number') {
      return translateResult(res);
    }
    return wrongTypeResult(defaultValue);
  }

  async resolveObjectEvaluation<U extends JsonValue>(
    flagKey: string,
    defaultValue: U,
    context: EvaluationContext,
  ): Promise<ResolutionDetails<U>> {
    const res = await this._client!.variationDetail(
      flagKey,
      translateContext(this._logger, context),
      defaultValue,
    );
    if (typeof res.value === 'object') {
      return translateResult(res);
    }
    return wrongTypeResult<U>(defaultValue);
  }

  // eslint-disable-next-line class-methods-use-this
  get hooks(): Hook[] {
    return [];
  }

  getClient(): TClient {
    return this._client!;
  }

  async onClose(): Promise<void> {
    await this._client?.flush();
    this._client?.close();
  }

  track(
    trackingEventName: string,
    context: EvaluationContext,
    trackingEventDetails: TrackingEventDetails,
  ): void {
    this._client?.track(
      trackingEventName,
      translateContext(this._logger, context),
      translateTrackingEventDetails(trackingEventDetails),
      trackingEventDetails?.value,
    );
  }
}
