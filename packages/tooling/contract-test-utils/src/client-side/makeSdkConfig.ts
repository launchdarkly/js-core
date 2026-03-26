import { makeLogger } from '../logging/makeLogger.js';
import { LDLogger } from '../types/compat.js';
import { SDKConfigParams } from '../types/ConfigParams.js';
import ClientSideTestHook from './TestHook.js';

/**
 * Base SDK config type produced by makeSdkConfig. Contains fields common to
 * all client-side SDKs. Consumers cast this to their platform-specific
 * LDOptions type, or spread additional platform-specific fields on top.
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

/**
 * Transforms test harness SDKConfigParams into a base SDK config object.
 *
 * This handles the common config fields shared by all client-side SDKs.
 * Platform-specific fields (e.g. `fetchGoals`, `initialConnectionMode`,
 * `automaticNetworkHandling`) should be added by the consumer:
 *
 * ```typescript
 * const config = { ...makeSdkConfig(options, tag), fetchGoals: false } as LDOptions;
 * ```
 */
export function makeSdkConfig(options: SDKConfigParams, tag: string): ClientSideSdkConfig {
  if (!options.clientSide) {
    throw new Error('configuration did not include clientSide options');
  }

  const isSet = (x?: unknown) => x !== null && x !== undefined;
  const maybeTime = (seconds?: number) => (isSet(seconds) ? seconds! / 1000 : undefined);

  const cf: ClientSideSdkConfig = {
    withReasons: options.clientSide.evaluationReasons,
    logger: makeLogger(`${tag}.sdk`),
    useReport: options.clientSide.useReport,
  };

  if (options.serviceEndpoints) {
    cf.streamUri = options.serviceEndpoints.streaming;
    cf.baseUri = options.serviceEndpoints.polling;
    cf.eventsUri = options.serviceEndpoints.events;
  }

  if (options.polling) {
    if (options.polling.baseUri) {
      cf.baseUri = options.polling.baseUri;
    }
  }

  if (options.streaming) {
    if (options.streaming.baseUri) {
      cf.streamUri = options.streaming.baseUri;
    }
    cf.streaming = true;
    cf.streamInitialReconnectDelay = maybeTime(options.streaming.initialRetryDelayMs);
  }

  if (options.events) {
    if (options.events.baseUri) {
      cf.eventsUri = options.events.baseUri;
    }
    cf.allAttributesPrivate = options.events.allAttributesPrivate;
    cf.capacity = options.events.capacity;
    cf.diagnosticOptOut = !options.events.enableDiagnostics;
    cf.flushInterval = maybeTime(options.events.flushIntervalMs);
    cf.privateAttributes = options.events.globalPrivateAttributes;
  } else {
    cf.sendEvents = false;
  }

  if (options.tags) {
    cf.applicationInfo = {
      id: options.tags.applicationId,
      version: options.tags.applicationVersion,
    };
  }

  if (options.hooks) {
    cf.hooks = options.hooks.hooks.map(
      (hook) => new ClientSideTestHook(hook.name, hook.callbackUri, hook.data, hook.errors),
    );
  }

  return cf;
}

export function makeDefaultInitialContext() {
  return { kind: 'user', key: 'key-not-specified' };
}
