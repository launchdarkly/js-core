import { Flag } from '../evaluation/data/Flag';
import { PersistentStoreDataKindInternal, persistentStoreKinds } from './persistentStoreKinds';
import { LDFeatureStoreDataStorage, LDKeyedFeatureStoreItem, LDFeatureStoreKindData } from '../api/subsystems';
import KeyedItem from '../api/interfaces/persistent_store/KeyedItem';
import PersistentStoreDataKind from '../api/interfaces/persistent_store/PersistentStoreDataKind';
import SerializedItemDescriptor from '../api/interfaces/persistent_store/SerializedItemDescriptor';

function getDependencyKeys(flag: Flag): string[] {
  if (!flag.prerequisites || !flag.prerequisites.length) {
    return [];
  }
  return flag.prerequisites.map((preReq) => preReq.key);
}

/**
 * For non-atomic stores we want to insert items in an order that no items exist
 * in the store before their dependencies. Segments before flags, because flags
 * are dependent on segments. For flags we want to insert them such that no flags are
 * added before the prerequisites of those flags.
 *
 * Segments can also depend on other segments, but a segment will not be accessed
 * if there are no flags.
 */
export function sortDataSet(
  dataMap: LDFeatureStoreDataStorage,
): KeyedItem<PersistentStoreDataKind, KeyedItem<string, SerializedItemDescriptor>[]>[] {
  const result: KeyedItem<PersistentStoreDataKindInternal, KeyedItem<string, SerializedItemDescriptor>[]>[] = [];

  Object.keys(dataMap).forEach((kindNamespace) => {
    const kind = persistentStoreKinds[kindNamespace];
    result.push({ key: kind, item: topologicalSort(kind, dataMap[kindNamespace]) });
  });

  result.sort((i1, i2) => i1.key.priority - i2.key.priority);
  return result;
}

/**
 * Do a topological sort using a depth-first search.
 * https://en.wikipedia.org/wiki/Topological_sorting
 */
function topologicalSort(
  kind: PersistentStoreDataKindInternal,
  itemsMap: LDFeatureStoreKindData,
): KeyedItem<string, SerializedItemDescriptor>[] {
  const sortedItems: KeyedItem<string, SerializedItemDescriptor>[] = [];
  const unvisitedItems: Set<string> = new Set(Object.keys(itemsMap));

  const visit = (key: string) => {
    if (!unvisitedItems.has(key)) {
      return;
    }

    // Typically in a depth-first search this would be done later, and there
    // would be a temporary mark to detect that this was not an directed acylic graph.
    // Removing it here will mean we cannot do that detection, but we also will
    // not infinitely recurse.
    unvisitedItems.delete(key);

    const item = itemsMap[key];

    if (kind.namespace === 'features') {
      getDependencyKeys(item as Flag).forEach((prereqKey) => {
        visit(prereqKey);
      });
    }

    sortedItems.push({
      key,
      item: kind.serialize(item),
    });
  };

  while (unvisitedItems.size > 0) {
    // Visit the next item, the order we visit doesn't matter.
    const key = unvisitedItems.values().next().value;
    visit(key);
  }
  return sortedItems;
}
