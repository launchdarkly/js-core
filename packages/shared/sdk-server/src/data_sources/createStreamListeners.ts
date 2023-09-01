import {
  EventName,
  LDLogger,
  ProcessStreamResponse,
  VoidFunction,
} from '@launchdarkly/js-sdk-common';

import { AsyncStoreFacade } from '../store';
import {
  AllData,
  DeleteData,
  deserializeAll,
  deserializeDelete,
  deserializePatch,
  PatchData,
} from '../store/serialization';
import VersionedDataKinds from '../store/VersionedDataKinds';

export const createPutListener = (
  featureStore: AsyncStoreFacade,
  logger?: LDLogger,
  onPutCompleteHandler?: VoidFunction,
) => ({
  deserializeData: deserializeAll,
  processJson: async ({ data: { flags, segments } }: AllData) => {
    const initData = {
      [VersionedDataKinds.Features.namespace]: flags,
      [VersionedDataKinds.Segments.namespace]: segments,
    };

    logger?.debug('Initializing all data');
    await featureStore.init(initData);
    onPutCompleteHandler?.();
  },
});

export const createPatchListener = (
  featureStore: AsyncStoreFacade,
  logger?: LDLogger,
  onPatchCompleteHandler?: VoidFunction,
) => ({
  deserializeData: deserializePatch,
  processJson: async ({ data, kind, path }: PatchData) => {
    if (kind) {
      const key = VersionedDataKinds.getKeyFromPath(kind, path);
      if (key) {
        logger?.debug(`Updating ${key} in ${kind.namespace}`);
        await featureStore.upsert(kind, data);
      }
    }

    onPatchCompleteHandler?.();
  },
});

export const createDeleteListener = (
  featureStore: AsyncStoreFacade,
  logger?: LDLogger,
  onDeleteCompleteHandler?: VoidFunction,
) => ({
  deserializeData: deserializeDelete,
  processJson: async ({ kind, path, version }: DeleteData) => {
    if (kind) {
      const key = VersionedDataKinds.getKeyFromPath(kind, path);
      if (key) {
        logger?.debug(`Deleting ${key} in ${kind.namespace}`);
        await featureStore.upsert(kind, {
          key,
          version,
          deleted: true,
        });
      }
    }

    onDeleteCompleteHandler?.();
  },
});

export const createStreamListeners = (
  featureStore: AsyncStoreFacade,
  logger?: LDLogger,
  onCompleteHandlers?: {
    put?: VoidFunction;
    patch?: VoidFunction;
    delete?: VoidFunction;
  },
) => {
  const listeners = new Map<EventName, ProcessStreamResponse>();
  listeners.set('put', createPutListener(featureStore, logger, onCompleteHandlers?.put));
  listeners.set('patch', createPatchListener(featureStore, logger, onCompleteHandlers?.patch));
  listeners.set('delete', createDeleteListener(featureStore, logger, onCompleteHandlers?.delete));
  return listeners;
};
