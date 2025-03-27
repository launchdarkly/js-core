import { LDLogger, subsystem } from '@launchdarkly/js-sdk-common';

import { LDBigSegmentsOptions, LDOptions, LDProxyOptions, LDTLSOptions } from '../api';
import { Hook } from '../api/integrations';
import { LDFeatureStore } from '../api/subsystems';

/**
 * This interface applies to the options after they have been validated and defaults
 * have been applied.
 *
 * @internal
 */
export interface ValidatedOptions {
  baseUri: string;
  streamUri: string;
  eventsUri: string;
  stream: boolean;
  streamInitialReconnectDelay: number;
  sendEvents: boolean;
  timeout: number;
  capacity: number;
  flushInterval: number;
  pollInterval: number;
  offline: boolean;
  useLdd: boolean;
  allAttributesPrivate: false;
  privateAttributes: string[];
  contextKeysCapacity: number;
  contextKeysFlushInterval: number;
  diagnosticOptOut: boolean;
  diagnosticRecordingInterval: number;
  featureStore: LDFeatureStore | ((options: LDOptions) => LDFeatureStore);
  tlsParams?: LDTLSOptions;
  updateProcessor?: subsystem.LDStreamProcessor;
  wrapperName?: string;
  wrapperVersion?: string;
  application?: { id?: string; version?: string; name?: string; versionName?: string };
  proxyOptions?: LDProxyOptions;
  logger?: LDLogger;
  // Allow indexing this by a string for the validation step.
  [index: string]: any;
  bigSegments?: LDBigSegmentsOptions;
  hooks?: Hook[];
  enableEventCompression: boolean;
}
