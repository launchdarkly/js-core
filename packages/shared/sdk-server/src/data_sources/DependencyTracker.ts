import NamespacedDataSet from './NamespacedDataSet';

/**
 * @internal
 */
export default class DependencyTracker {
  private readonly _dependenciesFrom = new NamespacedDataSet<NamespacedDataSet<boolean>>();

  private readonly _dependenciesTo = new NamespacedDataSet<NamespacedDataSet<boolean>>();

  updateDependenciesFrom(
    namespace: string,
    key: string,
    newDependencySet: NamespacedDataSet<boolean>,
  ) {
    const oldDependencySet = this._dependenciesFrom.get(namespace, key);
    oldDependencySet?.enumerate((depNs, depKey) => {
      const depsToThisDep = this._dependenciesTo.get(depNs, depKey);
      depsToThisDep?.remove(namespace, key);
    });

    this._dependenciesFrom.set(namespace, key, newDependencySet);
    newDependencySet?.enumerate((depNs, depKey) => {
      let depsToThisDep = this._dependenciesTo.get(depNs, depKey);
      if (!depsToThisDep) {
        depsToThisDep = new NamespacedDataSet();
        this._dependenciesTo.set(depNs, depKey, depsToThisDep);
      }
      depsToThisDep.set(namespace, key, true);
    });
  }

  updateModifiedItems(
    inDependencySet: NamespacedDataSet<boolean>,
    modifiedNamespace: string,
    modifiedKey: string,
  ) {
    if (!inDependencySet.get(modifiedNamespace, modifiedKey)) {
      inDependencySet.set(modifiedNamespace, modifiedKey, true);
      const affectedItems = this._dependenciesTo.get(modifiedNamespace, modifiedKey);
      affectedItems?.enumerate((namespace, key) => {
        this.updateModifiedItems(inDependencySet, namespace, key);
      });
    }
  }

  reset() {
    this._dependenciesFrom.removeAll();
    this._dependenciesTo.removeAll();
  }
}
