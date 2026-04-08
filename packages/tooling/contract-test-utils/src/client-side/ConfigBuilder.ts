import { makeLogger } from '../logging/makeLogger.js';
import { LDLogger } from '../types/compat.js';
import { CreateInstanceParams, SDKConfigParams } from '../types/ConfigParams.js';
import ClientSideTestHook from './TestHook.js';

/**
 * Base SDK config type produced by ConfigBuilder.build().
 * Contains fields common to all client-side SDKs. Consumers cast this
 * to their platform-specific LDOptions type.
 */
export interface ClientSideSdkConfig {
  withReasons?: boolean;
  logger?: LDLogger;
  useReport?: boolean;
  streamUri?: string;
  baseUri?: string;
  eventsUri?: string;
  streaming?: boolean;
  streamInitialReconnectDelay?: number;
  sendEvents?: boolean;
  allAttributesPrivate?: boolean;
  capacity?: number;
  diagnosticOptOut?: boolean;
  flushInterval?: number;
  privateAttributes?: string[];
  applicationInfo?: { id?: string; version?: string };
  hooks?: unknown[];
  [key: string]: unknown;
}

export type ConfigSection =
  | 'serviceEndpoints'
  | 'streaming'
  | 'polling'
  | 'events'
  | 'tags'
  | 'hooks';

/**
 * Config adapter for client-side contract test entities.
 *
 * Takes raw {@link CreateInstanceParams} from the test harness and provides:
 * an adapted SDK config object that could be used in our contract tests.
 *
 * ```typescript
 * const config = new ConfigBuilder(options)
 *   .skip('streaming')
 *   .set({ fetchGoals: false });
 *
 * const client = createClient(config.credential, config.initialContext, config.build());
 * await client.start({ timeout: config.timeout });
 * ```
 */
export class ConfigBuilder {
  private _configuration: SDKConfigParams;
  private _tag: string;
  private _skippedSections: Set<ConfigSection> = new Set();
  private _omittedKeys: Set<string> = new Set();
  private _overrides: Record<string, unknown> = {};

  constructor(options: CreateInstanceParams) {
    this._configuration = options.configuration;
    this._tag = options.tag;
  }

  get timeout(): number {
    const ms = this._configuration.startWaitTimeMs;
    return ms !== null && ms !== undefined ? ms : 5000;
  }

  get initialContext(): Record<string, any> {
    return (
      this._configuration.clientSide?.initialUser ||
      this._configuration.clientSide?.initialContext || { kind: 'user', key: 'key-not-specified' }
    );
  }

  get credential(): string {
    return this._configuration.credential || 'unknown-env-id';
  }

  get initCanFail(): boolean {
    return this._configuration.initCanFail ?? false;
  }

  get tag(): string {
    return this._tag;
  }

  get configuration(): SDKConfigParams {
    return this._configuration;
  }

  // -- Builder methods --

  /** Skip one or more config sections — they won't appear in the output. */
  skip(...sections: ConfigSection[]): this {
    sections.forEach((s) => this._skippedSections.add(s));
    return this;
  }

  /** Remove specific keys from the built output. Unlike skip(), the section
   *  still runs — only the named keys are deleted from the result. */
  omit(...keys: string[]): this {
    keys.forEach((k) => this._omittedKeys.add(k));
    return this;
  }

  /** Add or override fields on the final config object. Applied last. */
  set(values: Record<string, unknown>): this {
    Object.assign(this._overrides, values);
    return this;
  }

  /** Build the final SDK config object. */
  build(): ClientSideSdkConfig {
    if (!this._configuration.clientSide) {
      throw new Error('configuration did not include clientSide options');
    }

    const cf: ClientSideSdkConfig = {
      withReasons: this._configuration.clientSide.evaluationReasons,
      logger: makeLogger(`${this._tag}.sdk`),
      useReport: this._configuration.clientSide.useReport,
    };

    if (!this._skippedSections.has('serviceEndpoints') && this._configuration.serviceEndpoints) {
      cf.streamUri = this._configuration.serviceEndpoints.streaming;
      cf.baseUri = this._configuration.serviceEndpoints.polling;
      cf.eventsUri = this._configuration.serviceEndpoints.events;
    }

    if (!this._skippedSections.has('polling') && this._configuration.polling) {
      if (this._configuration.polling.baseUri) {
        cf.baseUri = this._configuration.polling.baseUri;
      }
    }

    if (!this._skippedSections.has('streaming') && this._configuration.streaming) {
      if (this._configuration.streaming.baseUri) {
        cf.streamUri = this._configuration.streaming.baseUri;
      }
      cf.streaming = true;
      cf.streamInitialReconnectDelay = this._maybeTime(
        this._configuration.streaming.initialRetryDelayMs,
      );
    }

    if (!this._skippedSections.has('events')) {
      if (this._configuration.events) {
        if (this._configuration.events.baseUri) {
          cf.eventsUri = this._configuration.events.baseUri;
        }
        cf.allAttributesPrivate = this._configuration.events.allAttributesPrivate;
        cf.capacity = this._configuration.events.capacity;
        cf.diagnosticOptOut = !this._configuration.events.enableDiagnostics;
        cf.flushInterval = this._maybeTime(this._configuration.events.flushIntervalMs);
        cf.privateAttributes = this._configuration.events.globalPrivateAttributes;
      } else {
        cf.sendEvents = false;
      }
    }

    if (!this._skippedSections.has('tags') && this._configuration.tags) {
      cf.applicationInfo = {
        id: this._configuration.tags.applicationId,
        version: this._configuration.tags.applicationVersion,
      };
    }

    if (!this._skippedSections.has('hooks') && this._configuration.hooks) {
      cf.hooks = this._configuration.hooks.hooks.map(
        (hook) => new ClientSideTestHook(hook.name, hook.callbackUri, hook.data, hook.errors),
      );
    }

    const result: ClientSideSdkConfig = { ...cf, ...this._overrides };
    this._omittedKeys.forEach((key) => delete result[key]);
    return result;
  }

  private _maybeTime(ms?: number): number | undefined {
    return ms !== null && ms !== undefined ? ms / 1000 : undefined;
  }
}
