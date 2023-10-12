// temporarily allow unused vars for the duration of the migration

/* eslint-disable @typescript-eslint/no-unused-vars */
import {
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
  subsystem,
  TypeValidators,
} from '@launchdarkly/js-sdk-common';

import { LDClient } from './api/LDClient';
import LDEmitter, { EventName } from './api/LDEmitter';
import LDOptions from './api/LDOptions';
import Configuration from './configuration';
import createDiagnosticsManager from './diagnostics/createDiagnosticsManager';
import fetchFlags, { RawFlag, RawFlags } from './evaluation/fetchFlags';
import createEventProcessor from './events/createEventProcessor';
import EventFactory from './events/EventFactory';

const { ClientMessages, ErrorKinds, EvalResult } = internal;

export default class LDClientImpl implements LDClient {
  config: Configuration;
  diagnosticsManager?: internal.DiagnosticsManager;
  eventProcessor: subsystem.LDEventProcessor;

  private eventFactoryDefault = new EventFactory(false);
  private eventFactoryWithReasons = new EventFactory(true);
  private emitter: LDEmitter;
  private rawFlags: RawFlags = {};
  private logger: LDLogger;

  /**
   * Creates the client object synchronously. No async, no network calls.
   */
  constructor(
    public readonly sdkKey: string,
    public readonly context: LDContext,
    public readonly platform: Platform,
    options: LDOptions,
  ) {
    if (!sdkKey) {
      throw new Error('You must configure the client with a client-side SDK key');
    }

    const checkedContext = Context.fromLDContext(context);
    if (!checkedContext.valid) {
      throw new Error('Context was unspecified or had no key');
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

    // TODO: init streamer
  }

  async start() {
    try {
      this.rawFlags = await fetchFlags(this.sdkKey, this.context, this.config, this.platform);
      this.emitter.emit('ready');
    } catch (error: any) {
      this.logger.error(error);
      this.emitter.emit('error', error);
      this.emitter.emit('failed', error);
    }
  }

  allFlags(): LDFlagSet {
    const result: LDFlagSet = {};
    Object.entries(this.rawFlags).forEach(([k, r]) => {
      result[k] = r.value;
    });
    return result;
  }

  close(): void {
    this.eventProcessor.close();
  }

  async flush(callback?: (err: Error | null, res: boolean) => void): Promise<void> {
    try {
      await this.eventProcessor.flush();
    } catch (err) {
      callback?.(err as Error, false);
    }
    callback?.(null, true);
  }

  getContext(): LDContext {
    return { ...this.context };
  }

  identify(
    context: LDContext,
    hash?: string,
    onDone?: (err: Error | null, rawFlags: LDFlagSet | null) => void,
  ): Promise<LDFlagSet> {
    // TODO:
    return Promise.resolve({});
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

  private sendEvalEvent(
    evalRes: internal.EvalResult,
    eventFactory: EventFactory,
    rawFlag: RawFlag,
    evalContext: Context,
    defaultValue: any,
    flagKey: string,
  ) {
    evalRes.events?.forEach((event) => {
      this.eventProcessor.sendEvent({ ...event });
    });
    this.eventProcessor.sendEvent(
      eventFactory.evalEventClient(flagKey, rawFlag, evalContext, evalRes.detail, defaultValue),
    );
  }

  private variationInternal(
    flagKey: string,
    defaultValue: any,
    eventFactory: EventFactory,
    typeChecker?: (value: any) => [boolean, string],
  ): LDFlagValue {
    const evalContext = Context.fromLDContext(this.context);
    const found = this.rawFlags[flagKey];

    if (!found) {
      const error = new LDClientError(`Unknown feature flag "${flagKey}"; returning default value`);
      this.emitter.emit('error', error);
      const result = EvalResult.forError(ErrorKinds.FlagNotFound, undefined, defaultValue);
      this.eventProcessor.sendEvent(
        this.eventFactoryDefault.unknownFlagEvent(flagKey, evalContext, result.detail),
      );
      return result;
    }

    const { reason, value, variation } = found;

    if (typeChecker) {
      const [matched, type] = typeChecker(value);
      if (!matched) {
        const errorRes = EvalResult.forError(
          ErrorKinds.WrongType,
          `Did not receive expected type (${type}) evaluating feature flag "${flagKey}"`,
          defaultValue,
        );
        this.sendEvalEvent(errorRes, eventFactory, found, evalContext, defaultValue, flagKey);
        return errorRes;
      }
    }

    // TODO: fix reason is nullable
    // @ts-ignore
    const finalResult = EvalResult.forSuccess(value, reason, variation);
    if (variation === undefined || variation === null) {
      this.logger.debug('Result value is null in variation');
      finalResult.setDefault(defaultValue);
    }
    this.sendEvalEvent(finalResult, eventFactory, found, evalContext, defaultValue, flagKey);
    return finalResult;
  }

  variation(flagKey: string, defaultValue?: LDFlagValue): LDFlagValue {
    const evalResult = this.variationInternal(flagKey, defaultValue, this.eventFactoryDefault);
    return evalResult.detail.value;
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
