import { LDLogger } from '@launchdarkly/js-sdk-common';
import {
  LDBigSegmentsOptions,
  LDOptions, LDProxyOptions, LDStreamProcessor, LDTLSOptions,
} from '../api';
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
  // TODO: This takes the non-validated options. We may want to consider wrapping
  // the validated config in its own interface.
  featureStore: LDFeatureStore | ((options: LDOptions) => LDFeatureStore);
  tlsParams?: LDTLSOptions;
  updateProcessor?: LDStreamProcessor;
  wrapperName?: string;
  wrapperVersion?: string;
  application?: { id?: string; version?: string; };
  proxyOptions?: LDProxyOptions;
  logger?: LDLogger;
  // Allow indexing this by a string for the validation step.
  [index: string]: any;
  bigSegments?: LDBigSegmentsOptions;
}
