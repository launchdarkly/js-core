import {
  ClientContext,
  clone,
  Context,
  internal,
  LDClientError,
  LDContext,
  LDEvaluationDetail,
  LDEvaluationDetailTyped,
  LDFlagSet,
  LDFlagValue,
  LDLogger,
  Platform,
  ProcessStreamResponse,
  EventName as StreamEventName,
  subsystem,
  TypeValidators,
} from '@launchdarkly/js-sdk-common';

import { LDClient, type LDOptions } from './api';
import LDEmitter, { EventName } from './api/LDEmitter';
import Configuration from './configuration';
import createDiagnosticsManager from './diagnostics/createDiagnosticsManager';
import createEventProcessor from './events/createEventProcessor';
import EventFactory from './events/EventFactory';
import { DeleteFlag, Flags, PatchFlag } from './types';
import { calculateFlagChanges } from './utils';

const { createErrorEvaluationDetail, createSuccessEvaluationDetail, ClientMessages, ErrorKinds } =
  internal;

export default class LDClientImpl implements LDClient {
  config: Configuration;
  context?: LDContext;
  diagnosticsManager?: internal.DiagnosticsManager;
  eventProcessor: subsystem.LDEventProcessor;
  streamer?: internal.StreamingProcessor;
  logger: LDLogger;

  private eventFactoryDefault = new EventFactory(false);
  private eventFactoryWithReasons = new EventFactory(true);
  private emitter: LDEmitter;
  private flags: Flags = {};
  private identifyChangeListener?: (c: LDContext, changedKeys: string[]) => void;
  private identifyErrorListener?: (c: LDContext, err: any) => void;

  private readonly clientContext: ClientContext;

  /**
   * Creates the client object synchronously. No async, no network calls.
   */
  constructor(
    public readonly sdkKey: string,
    public readonly platform: Platform,
    options: LDOptions,
    internalOptions?: internal.LDInternalOptions,
  ) {
    if (!sdkKey) {
      throw new Error('You must configure the client with a client-side SDK key');
    }

    if (!platform.encoding) {
      throw new Error('Platform must implement Encoding because btoa is required.');
    }

    this.config = new Configuration(options, internalOptions);
    this.clientContext = new ClientContext(sdkKey, this.config, platform);
    this.logger = this.config.logger;
    this.diagnosticsManager = createDiagnosticsManager(sdkKey, this.config, platform);
    this.eventProcessor = createEventProcessor(
      sdkKey,
      this.config,
      platform,
      this.diagnosticsManager,
    );
    this.emitter = new LDEmitter();
  }

  allFlags(): LDFlagSet {
    const result: LDFlagSet = {};
    Object.entries(this.flags).forEach(([k, r]) => {
      if (!r.deleted) {
        result[k] = r.value;
      }
    });
    return result;
  }

  async close(): Promise<void> {
    await this.flush();
    this.eventProcessor.close();
    this.streamer?.close();
  }

  async flush(): Promise<{ error?: Error; result: boolean }> {
    try {
      await this.eventProcessor.flush();
    } catch (e) {
      return { error: e as Error, result: false };
    }
    return { result: true };
  }

  getContext(): LDContext | undefined {
    return this.context ? clone<LDContext>(this.context) : undefined;
  }

  private createStreamListeners(
    context: LDContext,
    canonicalKey: string,
    identifyResolve: any,
  ): Map<StreamEventName, ProcessStreamResponse> {
    const listeners = new Map<StreamEventName, ProcessStreamResponse>();

    listeners.set('put', {
      deserializeData: JSON.parse,
      processJson: async (dataJson: Flags) => {
        this.logger.debug(`Streamer PUT: ${Object.keys(dataJson)}`);
        const changedKeys = calculateFlagChanges(this.flags, dataJson);
        this.context = context;
        this.flags = dataJson;
        await this.platform.storage?.set(canonicalKey, JSON.stringify(this.flags));

        if (changedKeys.length > 0) {
          this.logger.debug(`Emitting changes from PUT: ${changedKeys}`);
          // emitting change resolves identify
          this.emitter.emit('change', context, changedKeys);
        } else {
          // manually resolve identify
          this.logger.debug('Not emitting changes from PUT');
          identifyResolve();
        }
      },
    });

    listeners.set('patch', {
      deserializeData: JSON.parse,
      processJson: async (dataJson: PatchFlag) => {
        this.logger.debug(`Streamer PATCH ${JSON.stringify(dataJson, null, 2)}`);
        const existing = this.flags[dataJson.key];

        // add flag if it doesn't exist or update it if version is newer
        if (!existing || (existing && dataJson.version > existing.version)) {
          this.flags[dataJson.key] = dataJson;
          await this.platform.storage?.set(canonicalKey, JSON.stringify(this.flags));
          const changedKeys = [dataJson.key];
          this.logger.debug(`Emitting changes from PATCH: ${changedKeys}`);
          this.emitter.emit('change', context, changedKeys);
        }
      },
    });

    listeners.set('delete', {
      deserializeData: JSON.parse,
      processJson: async (dataJson: DeleteFlag) => {
        this.logger.debug(`Streamer DELETE ${JSON.stringify(dataJson, null, 2)}`);
        const existing = this.flags[dataJson.key];

        // the deleted flag is saved as tombstoned
        if (!existing || existing.version < dataJson.version) {
          this.flags[dataJson.key] = {
            ...dataJson,
            deleted: true,
            // props below are set to sensible defaults. they are irrelevant
            // because this flag has been deleted.
            flagVersion: 0,
            value: undefined,
            variation: 0,
            trackEvents: false,
          };
          await this.platform.storage?.set(canonicalKey, JSON.stringify(this.flags));
          const changedKeys = [dataJson.key];
          this.logger.debug(`Emitting changes from DELETE: ${changedKeys}`);
          this.emitter.emit('change', context, changedKeys);
        }
      },
    });

    return listeners;
  }

  /**
   * Generates the url path for streamer.
   *
   * For mobile key: /meval/${base64-encoded-context}
   * For clientSideId: /eval/${envId}/${base64-encoded-context}
   *
   * the path.
   *
   * @protected This function must be overridden in subclasses for streamer
   * to work.
   * @param _context The LDContext object
   */
  protected createStreamUriPath(_context: LDContext): string {
    throw new Error(
      'createStreamUriPath not implemented. Client sdks must implement createStreamUriPath for streamer to work',
    );
  }

  private createPromiseWithListeners() {
    let res: any;
    const p = new Promise<void>((resolve, reject) => {
      res = resolve;

      if (this.identifyChangeListener) {
        this.emitter.off('change', this.identifyChangeListener);
      }
      if (this.identifyErrorListener) {
        this.emitter.off('error', this.identifyErrorListener);
      }

      this.identifyChangeListener = (c: LDContext, changedKeys: string[]) => {
        this.logger.debug(`change: context: ${JSON.stringify(c)}, flags: ${changedKeys}`);
        resolve();
      };
      this.identifyErrorListener = (c: LDContext, err: any) => {
        this.logger.debug(`error: ${err}, context: ${JSON.stringify(c)}`);
        reject(err);
      };

      this.emitter.on('change', this.identifyChangeListener);
      this.emitter.on('error', this.identifyErrorListener);
    });

    return { identifyPromise: p, identifyResolve: res };
  }

  private async getFlagsFromStorage(canonicalKey: string): Promise<Flags | undefined> {
    const f = await this.platform.storage?.get(canonicalKey);
    return f ? JSON.parse(f) : undefined;
  }

  // TODO: implement secure mode
  async identify(pristineContext: LDContext, _hash?: string): Promise<void> {
    // the original context is injected with auto env attributes
    const context = {
      ...pristineContext,
      ...this.config.autoEnv,
    };

    const checkedContext = Context.fromLDContext(context);
    if (!checkedContext.valid) {
      const error = new Error('Context was unspecified or had no key');
      this.logger.error(error);
      this.emitter.emit('error', context, error);
      return Promise.reject(error);
    }

    const { identifyPromise, identifyResolve } = this.createPromiseWithListeners();
    this.logger.debug(`Identifying ${JSON.stringify(context)}`);
    this.emitter.emit('identifying', context);

    const flagsStorage = await this.getFlagsFromStorage(checkedContext.canonicalKey);
    if (flagsStorage) {
      this.logger.debug('Using storage');

      const changedKeys = calculateFlagChanges(this.flags, flagsStorage);
      this.context = context;
      this.flags = flagsStorage;
      this.emitter.emit('change', context, changedKeys);
    }

    this.streamer?.close();
    this.streamer = new internal.StreamingProcessor(
      this.sdkKey,
      this.clientContext,
      this.createStreamUriPath(context),
      this.createStreamListeners(context, checkedContext.canonicalKey, identifyResolve),
      this.diagnosticsManager,
      (e) => {
        this.logger.error(e);
        this.emitter.emit('error', context, e);
      },
    );
    this.streamer.start();

    return identifyPromise;
  }

  off(eventName: EventName, listener: Function): void {
    this.emitter.off(eventName, listener);
  }

  on(eventName: EventName, listener: Function): void {
    this.emitter.on(eventName, listener);
  }

  track(key: string, data?: any, metricValue?: number): void {
    if (!this.context) {
      this.logger?.warn(ClientMessages.missingContextKeyNoEvent);
      return;
    }
    const checkedContext = Context.fromLDContext(this.context);
    if (!checkedContext.valid) {
      this.logger?.warn(ClientMessages.missingContextKeyNoEvent);
      return;
    }

    this.eventProcessor.sendEvent(
      this.eventFactoryDefault.customEvent(key, checkedContext!, data, metricValue),
    );
  }

  // TODO: move variation functions to a separate file to make this file size
  // more manageable.
  private variationInternal(
    flagKey: string,
    defaultValue: any,
    eventFactory: EventFactory,
    typeChecker?: (value: any) => [boolean, string],
  ): LDFlagValue {
    if (!this.context) {
      this.logger?.debug(ClientMessages.missingContextKeyNoEvent);
      return createErrorEvaluationDetail(ErrorKinds.UserNotSpecified, defaultValue);
    }

    const evalContext = Context.fromLDContext(this.context);
    const found = this.flags[flagKey];

    if (!found || found.deleted) {
      const defVal = defaultValue ?? null;
      const error = new LDClientError(
        `Unknown feature flag "${flagKey}"; returning default value ${defVal}`,
      );
      this.logger.error(error);
      this.emitter.emit('error', this.context, error);
      this.eventProcessor.sendEvent(
        this.eventFactoryDefault.unknownFlagEvent(flagKey, defVal, evalContext),
      );
      return createErrorEvaluationDetail(ErrorKinds.FlagNotFound, defaultValue);
    }

    const { reason, value, variation } = found;

    if (typeChecker) {
      const [matched, type] = typeChecker(value);
      if (!matched) {
        this.eventProcessor.sendEvent(
          eventFactory.evalEventClient(
            flagKey,
            defaultValue, // track default value on type errors
            defaultValue,
            found,
            evalContext,
            reason,
          ),
        );
        const error = new LDClientError(
          `Wrong type "${type}" for feature flag "${flagKey}"; returning default value`,
        );
        this.logger.error(error);
        this.emitter.emit('error', this.context, error);
        return createErrorEvaluationDetail(ErrorKinds.WrongType, defaultValue);
      }
    }

    const successDetail = createSuccessEvaluationDetail(value, variation, reason);
    if (variation === undefined || variation === null) {
      this.logger.debug('Result value is null in variation');
      successDetail.value = defaultValue;
    }
    this.eventProcessor.sendEvent(
      eventFactory.evalEventClient(flagKey, value, defaultValue, found, evalContext, reason),
    );
    return successDetail;
  }

  variation(flagKey: string, defaultValue?: LDFlagValue): LDFlagValue {
    const { value } = this.variationInternal(flagKey, defaultValue, this.eventFactoryDefault);
    return value;
  }
  variationDetail(flagKey: string, defaultValue?: LDFlagValue): LDEvaluationDetail {
    return this.variationInternal(flagKey, defaultValue, this.eventFactoryWithReasons);
  }

  private typedEval<T>(
    key: string,
    defaultValue: T,
    eventFactory: EventFactory,
    typeChecker: (value: unknown) => [boolean, string],
  ): LDEvaluationDetailTyped<T> {
    return this.variationInternal(key, defaultValue, eventFactory, typeChecker);
  }

  boolVariation(key: string, defaultValue: boolean): boolean {
    return this.typedEval(key, defaultValue, this.eventFactoryDefault, (value) => [
      TypeValidators.Boolean.is(value),
      TypeValidators.Boolean.getType(),
    ]).value;
  }

  jsonVariation(key: string, defaultValue: unknown): unknown {
    return this.variation(key, defaultValue);
  }

  numberVariation(key: string, defaultValue: number): number {
    return this.typedEval(key, defaultValue, this.eventFactoryDefault, (value) => [
      TypeValidators.Number.is(value),
      TypeValidators.Number.getType(),
    ]).value;
  }

  stringVariation(key: string, defaultValue: string): string {
    return this.typedEval(key, defaultValue, this.eventFactoryDefault, (value) => [
      TypeValidators.String.is(value),
      TypeValidators.String.getType(),
    ]).value;
  }

  boolVariationDetail(key: string, defaultValue: boolean): LDEvaluationDetailTyped<boolean> {
    return this.typedEval(key, defaultValue, this.eventFactoryWithReasons, (value) => [
      TypeValidators.Boolean.is(value),
      TypeValidators.Boolean.getType(),
    ]);
  }

  numberVariationDetail(key: string, defaultValue: number): LDEvaluationDetailTyped<number> {
    return this.typedEval(key, defaultValue, this.eventFactoryWithReasons, (value) => [
      TypeValidators.Number.is(value),
      TypeValidators.Number.getType(),
    ]);
  }

  stringVariationDetail(key: string, defaultValue: string): LDEvaluationDetailTyped<string> {
    return this.typedEval(key, defaultValue, this.eventFactoryWithReasons, (value) => [
      TypeValidators.String.is(value),
      TypeValidators.String.getType(),
    ]);
  }

  jsonVariationDetail(key: string, defaultValue: unknown): LDEvaluationDetailTyped<unknown> {
    return this.variationDetail(key, defaultValue);
  }
}
