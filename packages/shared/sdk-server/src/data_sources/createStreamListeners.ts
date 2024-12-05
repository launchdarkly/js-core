import { internal, LDLogger } from '@launchdarkly/js-sdk-common';
import { Payload } from '@launchdarkly/js-sdk-common/dist/esm/internal';

import { LDDataSourceUpdates, LDFeatureStoreDataStorage } from '../api/subsystems';
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
  dataSourceUpdates: LDDataSourceUpdates,
  logger?: LDLogger,
  onPutCompleteHandler: VoidFunction = () => {},
) => ({
  deserializeData: deserializeAll,
  processJson: async ({ data: { flags, segments } }: AllData) => {
    const initData = {
      [VersionedDataKinds.Features.namespace]: flags,
      [VersionedDataKinds.Segments.namespace]: segments,
    };

    logger?.debug('Initializing all data');
    dataSourceUpdates.init(initData, onPutCompleteHandler);
  },
});

export const createPatchListener = (
  dataSourceUpdates: LDDataSourceUpdates,
  logger?: LDLogger,
  onPatchCompleteHandler: VoidFunction = () => {},
) => ({
  deserializeData: deserializePatch,
  processJson: async ({ data, kind, path }: PatchData) => {
    if (kind) {
      const key = VersionedDataKinds.getKeyFromPath(kind, path);
      if (key) {
        logger?.debug(`Updating ${key} in ${kind.namespace}`);
        dataSourceUpdates.upsert(kind, data, onPatchCompleteHandler);
      }
    }
  },
});

export const createDeleteListener = (
  dataSourceUpdates: LDDataSourceUpdates,
  logger?: LDLogger,
  onDeleteCompleteHandler: VoidFunction = () => {},
) => ({
  deserializeData: deserializeDelete,
  processJson: async ({ kind, path, version }: DeleteData) => {
    if (kind) {
      const key = VersionedDataKinds.getKeyFromPath(kind, path);
      if (key) {
        logger?.debug(`Deleting ${key} in ${kind.namespace}`);
        dataSourceUpdates.upsert(
          kind,
          {
            key,
            version,
            deleted: true,
          },
          onDeleteCompleteHandler,
        );
      }
    }
  },
});

export const createStreamListeners = (
  dataSourceUpdates: LDDataSourceUpdates,
  logger?: LDLogger,
  onCompleteHandlers?: {
    put?: VoidFunction;
    patch?: VoidFunction;
    delete?: VoidFunction;
  },
) => {
  const listeners = new Map<EventName, ProcessStreamResponse>();
  listeners.set('put', createPutListener(dataSourceUpdates, logger, onCompleteHandlers?.put));
  listeners.set('patch', createPatchListener(dataSourceUpdates, logger, onCompleteHandlers?.patch));
  listeners.set(
    'delete',
    createDeleteListener(dataSourceUpdates, logger, onCompleteHandlers?.delete),
  );
  return listeners;
};

export const createPayloadListener =
  (
    dataSourceUpdates: LDDataSourceUpdates,
    logger?: LDLogger,
    onCompleteHandlers?: {
      basisReceived?: VoidFunction;
    },
  ) =>
  (payload: Payload) => {
    if (payload.basis) {
      // convert basis to init param structure
      let converted: LDFeatureStoreDataStorage= {};
      payload.data.forEach((it: internal.Update) => {
        const namespaced = converted[it.kind];
        if (namespaced) {
          namespaced[it.key] = it.;
        } else {
          this.tempData[event.data.kind] = {
            [event.data.key]: item,
          };
        }
      });
      // merge new data into temp data
      

      logger?.debug('Initializing all data');
      dataSourceUpdates.init(convertedData, onCompleteHandlers?.basisReceived);
    } else {
      // convert data to upsert param
    }
  };

// const listeners = new Map<EventName, ProcessStreamResponse>();
// listeners.set('put', createPutListener(dataSourceUpdates, logger, onCompleteHandlers?.put));
// listeners.set('patch', createPatchListener(dataSourceUpdates, logger, onCompleteHandlers?.patch));
// listeners.set(
//   'delete',
//   createDeleteListener(dataSourceUpdates, logger, onCompleteHandlers?.delete),
// );
// return listeners;
