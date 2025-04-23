import { internal } from '@launchdarkly/js-sdk-common';

import { DataKind } from '../api/interfaces';
import {
  LDDataSourceUpdates,
  LDFeatureStore,
  LDFeatureStoreDataStorage,
  LDFeatureStoreItem,
  LDKeyedFeatureStoreItem,
} from '../api/subsystems';
import { Clause } from '../evaluation/data/Clause';
import { Flag } from '../evaluation/data/Flag';
import { Prerequisite } from '../evaluation/data/Prerequisite';
import VersionedDataKinds from '../store/VersionedDataKinds';
import DependencyTracker from './DependencyTracker';
import NamespacedDataSet from './NamespacedDataSet';

type InitMetadata = internal.InitMetadata;

/**
 * This type allows computing the clause dependencies of either a flag or a segment.
 */
interface TypeWithRuleClauses {
  prerequisites?: Prerequisite[];
  rules?: [
    {
      // The shape of rules are different between flags and segments, but
      // both have clauses of the same shape.
      clauses?: Clause[];
    },
  ];
}

function computeDependencies(namespace: string, item: LDFeatureStoreItem) {
  const ret = new NamespacedDataSet<boolean>();
  const isFlag = namespace === VersionedDataKinds.Features.namespace;
  const isSegment = namespace === VersionedDataKinds.Segments.namespace;
  if (isFlag) {
    const flag = item as Flag;
    flag?.prerequisites?.forEach((prereq) => {
      ret.set(namespace, prereq.key, true);
    });
  }

  if (isFlag || isSegment) {
    const itemWithRuleClauses = item as TypeWithRuleClauses;

    itemWithRuleClauses?.rules?.forEach((rule) => {
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
  private readonly _dependencyTracker = new DependencyTracker();

  constructor(
    private readonly _featureStore: LDFeatureStore,
    private readonly _hasEventListeners: () => boolean,
    private readonly _onChange: (key: string) => void,
  ) {}

  init(
    allData: LDFeatureStoreDataStorage,
    callback: () => void,
    initMetadata?: InitMetadata,
  ): void {
    const checkForChanges = this._hasEventListeners();
    const doInit = (oldData?: LDFeatureStoreDataStorage) => {
      this._featureStore.init(
        allData,
        () => {
          // Defer change events so they execute after the callback.
          Promise.resolve().then(() => {
            this._dependencyTracker.reset();

            Object.entries(allData).forEach(([namespace, items]) => {
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
              Object.keys(allData).forEach((namespace) => {
                const oldDataForKind = oldData?.[namespace] || {};
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
          });
          callback?.();
        },
        initMetadata,
      );
    };

    if (checkForChanges) {
      this._featureStore.all(VersionedDataKinds.Features, (oldFlags) => {
        this._featureStore.all(VersionedDataKinds.Segments, (oldSegments) => {
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
    const checkForChanges = this._hasEventListeners();
    const doUpsert = (oldItem?: LDFeatureStoreItem | null) => {
      this._featureStore.upsert(kind, data, () => {
        // Defer change events so they execute after the callback.
        Promise.resolve().then(() => {
          this._dependencyTracker.updateDependenciesFrom(
            kind.namespace,
            key,
            computeDependencies(kind.namespace, data),
          );
          if (checkForChanges) {
            const updatedItems = new NamespacedDataSet<boolean>();
            this.addIfModified(kind.namespace, key, oldItem, data, updatedItems);
            this.sendChangeEvents(updatedItems);
          }
        });

        callback?.();
      });
    };
    if (checkForChanges) {
      this._featureStore.get(kind, key, doUpsert);
    } else {
      doUpsert();
    }
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
