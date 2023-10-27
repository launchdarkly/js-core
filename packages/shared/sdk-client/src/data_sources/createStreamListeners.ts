/* eslint-disable no-param-reassign */
import {
  EventName,
  LDLogger,
  ProcessStreamResponse,
  VoidFunction,
} from '@launchdarkly/js-sdk-common';

import { Flag, Flags } from '../evaluation/fetchFlags';

export type StreamerPut = {
  data: Flags;
};

export type StreamerPatch = {
  data: { key: string } & Flag;
};

export type StreamerDelete = {
  data: { key: string; version: number };
};

export const createPutListener = (
  flags: Flags,
  logger?: LDLogger,
  onPutCompleteHandler: VoidFunction = () => {},
) => ({
  deserializeData: JSON.parse,
  processJson: ({ data }: StreamerPut) => {
    logger?.debug('Initializing all data');

    // this is not performant but it's the best I can come up with now
    Object.keys(flags).forEach((key) => delete flags[key]);
    Object.keys(data).forEach((key) => {
      flags[key] = data[key];
    });
    onPutCompleteHandler();
  },
});
export const createPatchListener = (
  flags: Flags,
  logger?: LDLogger,
  onPatchCompleteHandler: VoidFunction = () => {},
) => ({
  deserializeData: JSON.parse,
  processJson: ({ data }: StreamerPatch) => {
    logger?.debug(`Updating ${data.key}`);
    flags[data.key] = data;
    onPatchCompleteHandler();
  },
});

export const createDeleteListener = (
  flags: Flags,
  logger?: LDLogger,
  onDeleteCompleteHandler: VoidFunction = () => {},
) => ({
  deserializeData: JSON.parse,
  processJson: ({ data }: StreamerDelete) => {
    logger?.debug(`Deleting ${data.key}`);
    delete flags[data.key];
    onDeleteCompleteHandler();
  },
});

export const createStreamListeners = (
  flags: Flags,
  logger: LDLogger,
  onCompleteHandlers?: {
    put?: VoidFunction;
    patch?: VoidFunction;
    delete?: VoidFunction;
  },
) => {
  const listeners = new Map<EventName, ProcessStreamResponse>();
  listeners.set('put', createPutListener(flags, logger, onCompleteHandlers?.put));
  listeners.set('patch', createPatchListener(flags, logger, onCompleteHandlers?.patch));
  listeners.set('delete', createDeleteListener(flags, logger, onCompleteHandlers?.delete));
  return listeners;
};
