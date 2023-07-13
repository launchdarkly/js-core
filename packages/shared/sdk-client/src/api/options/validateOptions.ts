import { createSafeLogger } from '@launchdarkly/js-sdk-common';
import type { LDOptions } from './LDOptions';

export const DefaultLDOptions: LDOptions = {
  baseUrl: 'https://app.launchdarkly.com',
  streamUrl: 'https://clientstream.launchdarkly.com',
  eventsUrl: 'https://events.launchdarkly.com',
  sendEvents: true,
  sendLDHeaders: true,
  sendEventsOnlyForVariation: false,
  useReport: false,
  evaluationReasons: false,
  allAttributesPrivate: false,
  diagnosticOptOut: false,
  flushInterval: 2000, //{ default: 2000, minimum: 2000 },
  streamReconnectDelay: 1000, //{ default: 1000, minimum: 0 },
  diagnosticRecordingInterval: 900000, //{ default: 900000, minimum: 2000 },
  eventCapacity: 100, //{ default: 100, minimum: 1 },
  privateAttributes: [],
  inspectors: [],
};

const applyMinimum = (min: number, x?: number) => {
  return Math.min(min, x ?? min);
};

export const validateOptions = (o: LDOptions = DefaultLDOptions) => {
  return {
    ...o,
    logger: createSafeLogger(o.logger),
    flushInterval: applyMinimum(2000, o.flushInterval),
    streamReconnectDelay: applyMinimum(1000, o.streamReconnectDelay),
    diagnosticRecordingInterval: applyMinimum(900000, o.diagnosticRecordingInterval),
    eventCapacity: applyMinimum(100, o.eventCapacity),
  };
};
