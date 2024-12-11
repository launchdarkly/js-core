import { internal, LDLogger, VoidFunction } from '@launchdarkly/js-sdk-common';

import {
  LDDataSourceUpdates,
  LDFeatureStoreDataStorage,
  LDKeyedFeatureStoreItem,
} from '../api/subsystems';

const namespaceForKind = (kind: string) => {
  switch (kind) {
    case 'feature':
      return 'features';
    case 'segment':
      return 'segments';
    default:
      return kind;
  }
};

export const createPayloadListener =
  (
    dataSourceUpdates: LDDataSourceUpdates,
    logger?: LDLogger,
    basisReceived: VoidFunction = () => {},
  ) =>
  (payload: internal.Payload) => {
    // This conversion from FDv2 updates to the existing types used with DataSourceUpdates should be temporary.  Eventually
    // DataSourceUpdates will support update(...) taking in the list of updates.
    if (payload.basis) {
      // convert basis to init param structure
      // TODO: SDK-850 - remove conversion as part of FDv2 Persistence work
      const converted: LDFeatureStoreDataStorage = {};
      payload.updates.forEach((it: internal.Update) => {
        const namespace = namespaceForKind(it.kind);
        if (converted[namespace]) {
          // entry for kind already exists, add key
          converted[namespace][it.key] = {
            version: it.version,
            deleted: it.deleted,
            ...it.object,
          };
        } else {
          // entry for kind doesn't exist, add kind and key
          converted[namespace] = {
            [it.key]: {
              version: it.version,
              deleted: it.deleted,
              ...it.object,
            },
          };
        }
      });

      logger?.debug('Initializing all data');
      dataSourceUpdates.init(converted, basisReceived);
    } else {
      // convert data to upsert param
      // TODO: SDK-850 - remove conversion as part of FDv2 Persistence work
      payload.updates.forEach((it: internal.Update) => {
        const converted: LDKeyedFeatureStoreItem = {
          key: it.key,
          version: it.version,
          deleted: it.deleted,
          ...it.object,
        };

        if (it.deleted) {
          logger?.debug(`Deleting ${it.key} in ${it.kind}`);
        } else {
          logger?.debug(`Updating ${it.key} in ${it.kind}`);
        }

        dataSourceUpdates.upsert({ namespace: namespaceForKind(it.kind) }, converted, () => {});
      });
    }
  };
