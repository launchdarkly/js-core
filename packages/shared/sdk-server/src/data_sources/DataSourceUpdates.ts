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
    this.applyChanges(true, allData, callback, initMetadata); // basis is true for init. selector is undefined for FDv1 init
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
    initMetadata?: InitMetadata,
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
