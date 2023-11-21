// temporarily allow unused vars for the duration of the migration

/* eslint-disable @typescript-eslint/no-unused-vars */
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
import type { Flags } from './evaluation/fetchFlags';
import { base64UrlEncode } from './evaluation/fetchUtils';
import createEventProcessor from './events/createEventProcessor';
import EventFactory from './events/EventFactory';

const { createErrorEvaluationDetail, createSuccessEvaluationDetail, ClientMessages, ErrorKinds } =
  internal;

export default class LDClientImpl implements LDClient {
  config: Configuration;
  diagnosticsManager?: internal.DiagnosticsManager;
  eventProcessor: subsystem.LDEventProcessor;
  streamer?: internal.StreamingProcessor;

  private eventFactoryDefault = new EventFactory(false);
  private eventFactoryWithReasons = new EventFactory(true);
  private emitter: LDEmitter;
  private flags: Flags = {};
  private logger: LDLogger;

  /**
   * Creates the client object synchronously. No async, no network calls.
   */
  constructor(
    public readonly sdkKey: string,
    public context: LDContext,
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

  private createStreamListeners(): Map<StreamEventName, ProcessStreamResponse> {
    const listeners = new Map<StreamEventName, ProcessStreamResponse>();

    listeners.set('put', {
      deserializeData: JSON.parse,
      processJson: ({ data }) => {
        this.logger.debug('Initializing all data');
        this.flags = {};
        Object.keys(data).forEach((key) => {
          this.flags[key] = data[key];
        });
      },
    });

    listeners.set('patch', {
      deserializeData: JSON.parse,
      processJson: ({ data }) => {
        this.logger.debug(`Updating ${data.key}`);
        this.flags[data.key] = data;
      },
    });

    listeners.set('patch', {
      deserializeData: JSON.parse,
      processJson: ({ data }) => {
        this.logger.debug(`Deleting ${data.key}`);
        delete this.flags[data.key];
      },
    });

    return listeners;
  }

  private createStreamer(context: LDContext) {
    return new internal.StreamingProcessor(
      this.sdkKey,
      new ClientContext(this.sdkKey, this.config, this.platform),
      `/meval/${base64UrlEncode(JSON.stringify(context), this.platform.encoding!)}`,
      this.createStreamListeners(),
      this.diagnosticsManager,
      (e) => this.logger.error(e),
    );
  }
  // TODO: implement secure mode
  async identify(context: LDContext, hash?: string): Promise<void> {
    const checkedContext = Context.fromLDContext(context);
    if (!checkedContext.valid) {
      const error = new Error('Context was unspecified or had no key');
      this.logger.error(error);
      this.emitter.emit('error', error);
      throw error;
    }

    this.streamer = this.createStreamer(context);
    this.streamer.start();
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
    return clone(this.context);
  }

  off(eventName: EventName, listener?: Function): void {
    this.emitter.off(eventName, listener);
  }

  on(eventName: EventName, listener: Function): void {
    this.emitter.on(eventName, listener);
  }

  setStreaming(value?: boolean): void {
    // TODO:
  }

  track(key: string, data?: any, metricValue?: number): void {
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
    const evalContext = Context.fromLDContext(this.context);
    const found = this.flags[flagKey];

    if (!found) {
      const error = new LDClientError(`Unknown feature flag "${flagKey}"; returning default value`);
      this.emitter.emit('error', error);
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

  // TODO: add other typed variation functions
  boolVariation(key: string, defaultValue: boolean): boolean {
    return this.typedEval(key, defaultValue, this.eventFactoryDefault, (value) => [
      TypeValidators.Boolean.is(value),
      TypeValidators.Boolean.getType(),
    ]).value;
  }

  waitForInitialization(): Promise<void> {
    // TODO:
    return Promise.resolve(undefined);
  }

  waitUntilReady(): Promise<void> {
    // TODO:
    return Promise.resolve(undefined);
  }
}
