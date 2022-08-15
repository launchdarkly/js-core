import { DataKind } from '../api/interfaces';
import {
  LDDataSourceUpdates, LDFeatureStore, LDFeatureStoreDataStorage,
  LDFeatureStoreItem, LDKeyedFeatureStoreItem,
} from '../api/subsystems';
import { Flag } from '../evaluation/data/Flag';
import VersionedDataKinds from '../store/VersionedDataKinds';
import DependencyTracker from './DependencyTracker';
import NamespacedDataSet from './NamespacedDataSet';

function computeDependencies(namespace: string, item: LDFeatureStoreItem) {
  const ret = new NamespacedDataSet<boolean>();
  if (namespace === VersionedDataKinds.Features.namespace) {
    const flag = item as Flag;
    flag?.prerequisites?.forEach((prereq) => {
      ret.set(namespace, prereq.key, true);
    });
    flag?.rules?.forEach((rule) => {
      rule.clauses?.forEach((clause) => {
        if (clause.op === 'segmentMatch') {
          clause.values.forEach((value) => {
            ret.set(VersionedDataKinds.Segments.namespace, value, true);
          });
        }
      });
    });
  }
  return ret;
}

/**
 * @internal
 */
export default class DataSourceUpdates implements LDDataSourceUpdates {
  private readonly dependencyTracker = new DependencyTracker();

  constructor(
    private readonly featureStore: LDFeatureStore,
    private readonly hasEventListeners: () => boolean,
    private readonly onChange: (key: string) => void,
  ) {
  }

  init(allData: LDFeatureStoreDataStorage, callback: () => void): void {
    const checkForChanges = this.hasEventListeners();
    const doInit = (oldData?: LDFeatureStoreDataStorage) => {
      this.featureStore.init(allData, () => {
        this.dependencyTracker.reset();

        Object.entries(allData).forEach(([namespace, items]) => {
          Object.keys(items || {}).forEach((key) => {
            const item = items[key];
            this.dependencyTracker.updateDependenciesFrom(
              namespace,
              key,
              computeDependencies(namespace, item),
            );
          });
        });

        if (checkForChanges && oldData) {
          const updatedItems = new NamespacedDataSet<boolean>();
          Object.keys(allData).forEach((namespace) => {
            const oldDataForKind = oldData[namespace];
            const newDataForKind = allData[namespace];
            const mergedData = { ...oldDataForKind, ...newDataForKind };
            Object.keys(mergedData).forEach((key) => {
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

        callback?.();
      });
    };

    if (checkForChanges) {
      this.featureStore.all(VersionedDataKinds.Features, (oldFlags) => {
        this.featureStore.all(VersionedDataKinds.Segments, (oldSegments) => {
          const oldData = {
            [VersionedDataKinds.Features.namespace]: oldFlags,
            [VersionedDataKinds.Segments.namespace]: oldSegments,
          };
          doInit(oldData);
        });
      });
    } else {
      doInit();
    }
  }

  upsert(kind: DataKind, data: LDKeyedFeatureStoreItem, callback: () => void): void {
    const { key } = data;
    const checkForChanges = this.hasEventListeners();
    const doUpsert = (oldItem?: LDFeatureStoreItem | null) => {
      this.featureStore.upsert(kind, data, () => {
        this.dependencyTracker.updateDependenciesFrom(
          kind.namespace,
          key,
          computeDependencies(kind.namespace, data),
        );
        if (checkForChanges && oldItem) {
          const updatedItems = new NamespacedDataSet<boolean>();
          this.addIfModified(kind.namespace, key, oldItem, data, updatedItems);
          this.sendChangeEvents(updatedItems);
        }
        callback?.();
      });
    };
    if (checkForChanges) {
      this.featureStore.get(kind, key, doUpsert);
    } else {
      doUpsert();
    }
  }

  addIfModified(
    namespace: string,
    key: string,
    oldValue: LDFeatureStoreItem,
    newValue: LDFeatureStoreItem,
    toDataSet: NamespacedDataSet<boolean>,
  ) {
    if (newValue && oldValue && newValue.version <= oldValue.version) {
      return;
    }
    this.dependencyTracker.updateModifiedItems(toDataSet, namespace, key);
  }

  sendChangeEvents(dataSet: NamespacedDataSet<boolean>) {
    dataSet.enumerate((namespace, key) => {
      if (namespace === VersionedDataKinds.Features.namespace) {
        this.onChange(key);
      }
    });
  }
}
