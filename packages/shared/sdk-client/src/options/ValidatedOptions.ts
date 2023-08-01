import { LDFlagSet, LDLogger } from '@launchdarkly/js-sdk-common';

import { LDInspection } from '../api/LDInspection';

export default interface ValidatedOptions {
  logger: LDLogger;
  bootstrap?: 'localStorage' | LDFlagSet;
  baseUri: string;
  eventsUri: string;
  streamUri: string;
  stream?: boolean;
  useReport: boolean;
  sendLDHeaders: boolean;
  requestHeaderTransform?: (headers: Map<string, string>) => Map<string, string>;
  evaluationReasons: boolean;
  sendEvents: boolean;
  allAttributesPrivate: boolean;
  privateAttributes: Array<string>;
  sendEventsOnlyForVariation: boolean;
  capacity: number;
  flushInterval: number;
  streamReconnectDelay: number;
  diagnosticOptOut: boolean;
  diagnosticRecordingInterval: number;
  wrapperName?: string;
  wrapperVersion?: string;
  application?: {
    id?: string;
    version?: string;
  };
  inspectors: LDInspection[];

  // Allow indexing this by a string for the validation step.
  [index: string]: any;
}
