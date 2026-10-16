import DependencyTracker from '../../src/data_sources/DependencyTracker';
import NamespacedDataSet from '../../src/data_sources/NamespacedDataSet';

describe('given keys that are the names of properties of Object', () => {
  const keys = ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf'];

  it('stores, finds, enumerates, and removes such entries like any other', () => {
    const set = new NamespacedDataSet<number>();
    keys.forEach((key, index) => set.set('features', key, index));
    keys.forEach((key, index) => expect(set.get('features', key)).toBe(index));
    expect(set.get('features', 'missing')).toBeUndefined();
    expect(set.get('constructor', 'constructor')).toBeUndefined();

    const seen: string[] = [];
    set.enumerate((_namespace, key) => seen.push(key));
    expect(seen.sort()).toEqual([...keys].sort());

    set.remove('features', '__proto__');
    expect(set.get('features', '__proto__')).toBeUndefined();
    expect(set.get('features', 'constructor')).toBe(0);
  });

  it('tracks dependencies between items with such keys', () => {
    // Before the maps lost their prototype, looking up "constructor" returned Object's
    // constructor function and the tracker threw while updating.
    const tracker = new DependencyTracker();
    const deps = new NamespacedDataSet<boolean>();
    deps.set('segments', '__proto__', true);
    tracker.updateDependenciesFrom('features', 'constructor', deps);
    tracker.updateDependenciesFrom('features', 'constructor', deps);

    const affected = new NamespacedDataSet<boolean>();
    tracker.updateModifiedItems(affected, 'segments', '__proto__');
    const items: string[] = [];
    affected.enumerate((namespace, key) => items.push(`${namespace}/${key}`));
    expect(items.sort()).toEqual(['features/constructor', 'segments/__proto__']);
  });
});
