// temporarily allow unused vars for the duration of the migration

/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  base64UrlEncode,
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
import { Flags } from './evaluation/fetchFlags';
import createEventProcessor from './events/createEventProcessor';
import EventFactory from './events/EventFactory';

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
  private identifyReadyListener?: (c: LDContext) => void;
  private identifyErrorListener?: (c: LDContext, err: any) => void;

  private readonly clientContext: ClientContext;
  /**
   * Creates the client object synchronously. No async, no network calls.
   */
  constructor(
    public readonly sdkKey: string,
    public readonly platform: Platform,
    options: LDOptions,
  ) {
    if (!sdkKey) {
      throw new Error('You must configure the client with a client-side SDK key');
    }

    if (!platform.encoding) {
      throw new Error('Platform must implement Encoding because btoa is required.');
    }

    this.config = new Configuration(options);
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
      result[k] = r.value;
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

  getContext(): LDContext {
    return this.context ? clone(this.context) : undefined;
  }

  private createStreamListeners(context: LDContext): Map<StreamEventName, ProcessStreamResponse> {
    const listeners = new Map<StreamEventName, ProcessStreamResponse>();

    listeners.set('put', {
      deserializeData: JSON.parse,
      processJson: (dataJson) => {
        this.logger.debug('Initializing all data');
        this.context = context;
        this.flags = {};
        Object.keys(dataJson).forEach((key) => {
          this.flags[key] = dataJson[key];
        });
        this.emitter.emit('ready', context);
      },
    });

    listeners.set('patch', {
      deserializeData: JSON.parse,
      processJson: (dataJson) => {
        this.logger.debug(`Updating ${dataJson.key}`);
        this.flags[dataJson.key] = dataJson;
        this.emitter.emit('change', context, dataJson.key);
      },
    });

    listeners.set('delete', {
      deserializeData: JSON.parse,
      processJson: (dataJson) => {
        this.logger.debug(`Deleting ${dataJson.key}`);
        delete this.flags[dataJson.key];
        this.emitter.emit('change', context, dataJson.key);
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
   * @param context The LD context object to be base64 encoded and appended to
   * the path.
   *
   * @protected This function must be overridden in subclasses for streamer
   * to work.
   */
  protected createStreamUriPath(context: LDContext): string {
    throw new Error(
      'createStreamUriPath not implemented. client sdks must implement createStreamUriPath for streamer to work',
    );
  }

  private createIdentifyPromise() {
    return new Promise<void>((resolve, reject) => {
      if (this.identifyReadyListener) {
        this.emitter.off('ready', this.identifyReadyListener);
      }
      if (this.identifyErrorListener) {
        this.emitter.off('error', this.identifyErrorListener);
      }

      this.identifyReadyListener = (c: LDContext) => {
        this.logger.debug(`ready: ${JSON.stringify(c)}`);
        resolve();
      };
      this.identifyErrorListener = (c: LDContext, err: any) => {
        this.logger.debug(`error: ${err}, context: ${JSON.stringify(c)}`);
        reject(err);
      };

      this.emitter.on('ready', this.identifyReadyListener);
      this.emitter.on('error', this.identifyErrorListener);
    });
  }

  // TODO: implement secure mode
  async identify(context: LDContext, _hash?: string): Promise<void> {
    const checkedContext = Context.fromLDContext(context);
    if (!checkedContext.valid) {
      const error = new Error('Context was unspecified or had no key');
      this.logger.error(error);
      this.emitter.emit('error', context, error);
      return Promise.reject(error);
    }

    this.streamer?.close();
    this.streamer = new internal.StreamingProcessor(
      this.sdkKey,
      this.clientContext,
      this.createStreamUriPath(context),
      this.createStreamListeners(context),
      this.diagnosticsManager,
      (e) => {
        this.logger.error(e);
        this.emitter.emit('error', context, e);
      },
    );
    this.emitter.emit('connecting', context);
    this.streamer.start();

    return this.createIdentifyPromise();
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

    if (!found) {
      const error = new LDClientError(`Unknown feature flag "${flagKey}"; returning default value`);
      this.logger.error(error);
      this.emitter.emit('error', this.context, error);
      this.eventProcessor.sendEvent(
        this.eventFactoryDefault.unknownFlagEvent(flagKey, defaultValue ?? null, evalContext),
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
