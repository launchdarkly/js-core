import { internal, LDLogger, VoidFunction } from '@launchdarkly/js-sdk-common';

import { LDFeatureStoreDataStorage, LDTransactionalDataSourceUpdates } from '../api/subsystems';

const namespaceForKind = (kind: string) => {
  switch (kind) {
    case 'flag':
      return 'features';
    case 'segment':
      return 'segments';
    default:
      return kind;
  }
};

export interface DataCallbackContainer {
  initMetadata?: internal.InitMetadata;
  payload: internal.Payload;
}

export const createPayloadListener =
  (
    dataSourceUpdates: LDTransactionalDataSourceUpdates,
    logger?: LDLogger,
    initializedCallback: VoidFunction = () => {},
  ) =>
  (dataContainer: DataCallbackContainer) => {
    const { initMetadata, payload } = dataContainer;
    if (payload.type === 'full') {
      logger?.debug('Initializing all data');
    } else if (payload.updates.length > 0) {
      logger?.debug('Applying updates');
    } else {
      logger?.debug('Payload had no updates, ignoring.');
      return;
    }

    // convert to LDFeatureStoreDataStorage structure
    const converted: LDFeatureStoreDataStorage = {};
    payload.updates.forEach((it: internal.Update) => {
      const namespace = namespaceForKind(it.kind);
      if (converted[namespace]) {
        // entry for kind already exists, add key
        converted[namespace][it.key] = {
          version: it.version,
          ...(it.deleted && { deleted: it.deleted }),
          ...it.object,
        };
      } else {
        // entry for kind doesn't exist, add kind and key
        converted[namespace] = {
          [it.key]: {
            version: it.version,
            ...(it.deleted && { deleted: it.deleted }),
            ...it.object,
          },
        };
      }

      if (it.deleted) {
        logger?.debug(`Deleting ${it.key} in ${it.kind}`);
      } else {
        logger?.debug(`Updating ${it.key} in ${it.kind}`);
      }
    });

    // TODO: SDK-1209 - SUpport initMetadata in FDv2 datasources
    dataSourceUpdates.applyChanges(
      payload.type === 'full',
      converted,
      () => {
        if (payload.state !== '') {
          // NOTE: The only condition that we will consider a valid basis
          // is when there is a valid selector. Currently, the only data source that does not have a
          // valid selector is the file data initializer, which will have a blank selector.
          initializedCallback();
        }
      },
      initMetadata,
      payload.state,
    );
  };
