import NamespacedDataSet from './NamespacedDataSet';

/**
 * @internal
 */
export default class DependencyTracker {
  private readonly dependenciesFrom = new NamespacedDataSet<NamespacedDataSet<boolean>>();

  private readonly dependenciesTo = new NamespacedDataSet<NamespacedDataSet<boolean>>();

  updateDependenciesFrom(
    namespace: string,
    key: string,
    newDependencySet: NamespacedDataSet<boolean>
  ) {
    const oldDependencySet = this.dependenciesFrom.get(namespace, key);
    oldDependencySet?.enumerate((depNs, depKey) => {
      const depsToThisDep = this.dependenciesTo.get(depNs, depKey);
      depsToThisDep?.remove(namespace, key);
    });

    this.dependenciesFrom.set(namespace, key, newDependencySet);
    newDependencySet?.enumerate((depNs, depKey) => {
      let depsToThisDep = this.dependenciesTo.get(depNs, depKey);
      if (!depsToThisDep) {
        depsToThisDep = new NamespacedDataSet();
        this.dependenciesTo.set(depNs, depKey, depsToThisDep);
      }
      depsToThisDep.set(namespace, key, true);
    });
  }

  updateModifiedItems(
    inDependencySet: NamespacedDataSet<boolean>,
    modifiedNamespace: string,
    modifiedKey: string
  ) {
    if (!inDependencySet.get(modifiedNamespace, modifiedKey)) {
      inDependencySet.set(modifiedNamespace, modifiedKey, true);
      const affectedItems = this.dependenciesTo.get(modifiedNamespace, modifiedKey);
      affectedItems?.enumerate((namespace, key) => {
        this.updateModifiedItems(inDependencySet, namespace, key);
      });
    }
  }

  reset() {
    this.dependenciesFrom.removeAll();
    this.dependenciesTo.removeAll();
  }
}
