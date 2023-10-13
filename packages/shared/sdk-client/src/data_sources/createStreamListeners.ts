/* eslint-disable no-param-reassign */
import { EventName, LDLogger, ProcessStreamResponse } from '@launchdarkly/js-sdk-common';

import { Flag, Flags } from './fetchFlags';

export type StreamerPut = {
  data: Flags;
};

export type StreamerPatch = {
  data: { key: string } & Flag;
};

export type StreamerDelete = {
  data: { key: string; version: number };
};

export const createPutListener = (onPut: (flags: Flags) => void, logger?: LDLogger) => ({
  deserializeData: JSON.parse,
  processJson: ({ data }: StreamerPut) => {
    logger?.debug('Initializing all data');
    onPut(data);
  },
});
export const createPatchListener = (flags: Flags, logger?: LDLogger) => ({
  deserializeData: JSON.parse,
  processJson: ({ data }: StreamerPatch) => {
    logger?.debug(`Updating ${data.key}`);
    flags[data.key] = data;
  },
});

export const createDeleteListener = (flags: Flags, logger?: LDLogger) => ({
  deserializeData: JSON.parse,
  processJson: ({ data }: StreamerDelete) => {
    logger?.debug(`Deleting ${data.key}`);
    delete flags[data.key];
  },
});

export const createStreamListeners = (
  flags: Flags,
  onPut: (flags: Flags) => void,
  logger?: LDLogger,
) => {
  const listeners = new Map<EventName, ProcessStreamResponse>();
  listeners.set('put', createPutListener(onPut, logger));
  listeners.set('patch', createPatchListener(flags, logger));
  listeners.set('delete', createDeleteListener(flags, logger));
  return listeners;
};
