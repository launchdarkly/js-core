import { internal } from '@launchdarkly/js-sdk-common';

import { DataKind } from '../api/interfaces';
import {
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDKeyedFeatureStoreItem,
  LDTransactionalDataSourceUpdates,
  LDTransactionalFeatureStore,
} from '../api/subsystems';
import VersionedDataKinds from '../store/VersionedDataKinds';
import { computeDependencies } from './DataSourceUpdates';
import DependencyTracker from './DependencyTracker';
import NamespacedDataSet from './NamespacedDataSet';

/**
 * @internal
 */
export default class TransactionalDataSourceUpdates implements LDTransactionalDataSourceUpdates {
  private readonly _dependencyTracker = new DependencyTracker();

  constructor(
    private readonly _featureStore: LDTransactionalFeatureStore,
    private readonly _hasEventListeners: () => boolean,
    private readonly _onChange: (key: string) => void,
  ) {}

  init(
    allData: LDFeatureStoreDataStorage,
    callback: () => void,
    initMetadata?: internal.InitMetadata,
  ): void {
    this.applyChanges(true, allData, callback, initMetadata); // basis is true for init
  }

  upsert(kind: DataKind, data: LDKeyedFeatureStoreItem, callback: () => void): void {
    this.applyChanges(
      false, // basis is false for upserts
      {
        [kind.namespace]: {
          [data.key]: data,
        },
      },
      callback,
    );
  }

  applyChanges(
    basis: boolean,
    data: LDFeatureStoreDataStorage,
    callback: () => void,
    initMetadata?: internal.InitMetadata,
    selector?: String,
  ): void {
    const checkForChanges = this._hasEventListeners();
    const doApplyChanges = (oldData: LDFeatureStoreDataStorage) => {
      this._featureStore.applyChanges(
        basis,
        data,
        () => {
          // Defer change events so they execute after the callback.
          Promise.resolve().then(() => {
            if (basis) {
              this._dependencyTracker.reset();
            }

            Object.entries(data).forEach(([namespace, items]) => {
              Object.keys(items || {}).forEach((key) => {
                const item = items[key];
                this._dependencyTracker.updateDependenciesFrom(
                  namespace,
                  key,
                  computeDependencies(namespace, item),
                );
              });
            });

            if (checkForChanges) {
              const updatedItems = new NamespacedDataSet<boolean>();
              Object.keys(data).forEach((namespace) => {
                const oldDataForKind = oldData[namespace];
                const newDataForKind = data[namespace];
                let iterateData;
                if (basis) {
                  // for basis, need to iterate on all keys
                  iterateData = { ...oldDataForKind, ...newDataForKind };
                } else {
                  // for non basis, only need to iterate on keys in incoming data
                  iterateData = { ...newDataForKind };
                }
                Object.keys(iterateData).forEach((key) => {
                  this.addIfModified(
                    namespace,
                    key,
                    oldDataForKind && oldDataForKind[key],
                    newDataForKind && newDataForKind[key],
                    updatedItems,
                  );
                });
              });

              this.sendChangeEvents(updatedItems);
            }
          });
          callback?.();
        },
        initMetadata,
        selector,
      );
    };

    let oldData = {};
    if (checkForChanges) {
      // record old data before making changes to use for change calculations
      this._featureStore.all(VersionedDataKinds.Features, (oldFlags) => {
        this._featureStore.all(VersionedDataKinds.Segments, (oldSegments) => {
          oldData = {
            [VersionedDataKinds.Features.namespace]: oldFlags,
            [VersionedDataKinds.Segments.namespace]: oldSegments,
          };
        });
      });
    }

    doApplyChanges(oldData);
  }

  addIfModified(
    namespace: string,
    key: string,
    oldValue: LDFeatureStoreItem | null | undefined,
    newValue: LDFeatureStoreItem,
    toDataSet: NamespacedDataSet<boolean>,
  ) {
    if (newValue && oldValue && newValue.version <= oldValue.version) {
      return;
    }
    this._dependencyTracker.updateModifiedItems(toDataSet, namespace, key);
  }

  sendChangeEvents(dataSet: NamespacedDataSet<boolean>) {
    dataSet.enumerate((namespace, key) => {
      if (namespace === VersionedDataKinds.Features.namespace) {
        this._onChange(key);
      }
    });
  }
}
