// temporarily allow unused vars for the duration of the migration

/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Context,
  internal,
  LDClientError,
  LDContext,
  LDEvaluationDetail,
  LDFlagSet,
  LDFlagValue,
  LDLogger,
  Platform,
  subsystem,
} from '@launchdarkly/js-sdk-common';
import { InputEvalEvent } from '@launchdarkly/js-sdk-common/dist/internal';

import { LDClient } from './api/LDClient';
import LDEmitter, { EventName } from './api/LDEmitter';
import LDOptions from './api/LDOptions';
import Configuration from './configuration';
import createDiagnosticsManager from './diagnostics/createDiagnosticsManager';
import fetchFlags, { RawFlag, RawFlags } from './evaluation/fetchFlags';
import createEventProcessor from './events/createEventProcessor';

const { ErrorKinds, EvalResult } = internal;

export default class LDClientImpl implements LDClient {
  config: Configuration;
  diagnosticsManager?: internal.DiagnosticsManager;
  eventProcessor: subsystem.LDEventProcessor;
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
    return this.rawFlags;
  }

  close(onDone?: () => void): Promise<void> {
    return Promise.resolve(undefined);
  }

  flush(onDone?: () => void): Promise<void> {
    return Promise.resolve(undefined);
  }

  getContext(): LDContext {
    return { kind: 'user', key: 'test-context-1' };
  }

  identify(
    context: LDContext,
    hash?: string,
    onDone?: (err: Error | null, rawFlags: LDFlagSet | null) => void,
  ): Promise<LDFlagSet> {
    return Promise.resolve({});
  }

  off(eventName: EventName, listener?: Function): void {
    this.emitter.off(eventName, listener);
  }

  on(eventName: EventName, listener: Function): void {
    this.emitter.on(eventName, listener);
  }

  setStreaming(value?: boolean): void {}

  track(key: string, data?: any, metricValue?: number): void {}

  createEvalEvent(flagKey: string, defaultValue: LDFlagValue, flag: RawFlag) {
    // const event = {
    //   kind: 'feature',
    //   creationDate: now.getTime(),
    //   key: key,
    //   value: value,
    //   default: defaultValue,
    //   //prereq
    //   variation: detail ? detail.variationIndex : null,
    //   context,
    // };
    // const flag = flags[key];
    // if (flag) {
    //   event.version = flag.flagVersion ? flag.flagVersion : flag.version;
    //   event.trackEvents = flag.trackEvents;
    //   event.debugEventsUntilDate = flag.debugEventsUntilDate;
    // }
    // if ((includeReason || (flag && flag.trackReason)) && detail) {
    //   event.reason = detail.reason;
    // }

    return new InputEvalEvent(
      this.config.withReasons,
      Context.fromLDContext(this.context),
      flagKey,
      defaultValue,
      detail,
      flag.version,
      flag.variation,
      flag.trackEvents,
      undefined,
      this.config.withReasons ? detail.reason : undefined,
      flag.debugEventsUntilDate,
    );
  }
  variation(flagKey: string, defaultValue?: LDFlagValue): LDFlagValue {
    const found = this.rawFlags[flagKey];

    if (!found) {
      const error = new LDClientError(`Unknown feature flag "${flagKey}"; returning default value`);
      this.emitter.emit('error', error);
      const result = EvalResult.forError(ErrorKinds.FlagNotFound, undefined, defaultValue);
      const e = this.createEvalEvent(flagKey, defaultValue, found);
      this.eventProcessor.sendEvent(
        this.eventFactoryDefault.unknownFlagEvent(flagKey, this.context, result.detail),
      );
      return defaultValue;
    }

    const { value, variation } = this.rawFlags[found];
    if (!variation) {
      this.logger.debug('Result value is null in variation');
      // evalRes.setDefault(defaultValue);
    }

    if (typeChecker) {
      const [matched, type] = typeChecker(value);
      if (!matched) {
        const errorRes = EvalResult.forError(
          ErrorKinds.WrongType,
          `Did not receive expected type (${type}) evaluating feature flag "${flagKey}"`,
          defaultValue,
        );
        // this.sendEvalEvent(errorRes, eventFactory, flag, evalContext, defaultValue);
        return value;
      }
    }

    // this.sendEvalEvent(evalRes, eventFactory, flag, evalContext, defaultValue);
    return value;
  }

  variationDetail(key: string, defaultValue?: LDFlagValue): LDEvaluationDetail {
    const defaultDetail = {
      value: defaultValue,
      variationIndex: null,
      reason: { kind: 'ERROR', errorKind: 'FLAG_NOT_FOUND' },
    };
    return defaultDetail;
  }

  waitForInitialization(): Promise<void> {
    return Promise.resolve(undefined);
  }

  waitUntilReady(): Promise<void> {
    return Promise.resolve(undefined);
  }
}
