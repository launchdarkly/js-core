import { PersistentStoreDataKind, SerializedItemDescriptor } from '../api/interfaces';
import ItemDescriptor from '../api/interfaces/persistent_store/ItemDescriptor';
import {
  deserializeFlag, deserializeSegment, serializeFlag, serializeSegment,
} from './serialization';
import VersionedDataKinds from './VersionedDataKinds';

/**
 * The public interface doesn't have a serialize method, but for internal use we want to be
 * able to serialize items. Additionally we also need priority internally for sorting
 * kinds.
 */
export type PersistentStoreDataKindInternal = PersistentStoreDataKind
& {
  serialize: (data: any) => SerializedItemDescriptor;
  priority: number,
};

/**
 * Map namespace to a persistent store kind.
 */
export const persistentStoreKinds: Record<string, PersistentStoreDataKindInternal> = {
  segments: {
    namespace: VersionedDataKinds.Segments.namespace,
    deserialize: (data: string): ItemDescriptor | undefined => {
      const segment = deserializeSegment(data);
      if (segment) {
        return {
          version: segment.version,
          item: segment,
        };
      }
      return undefined;
    },
    serialize: (data: any): SerializedItemDescriptor => {
      const serializedItem = serializeSegment(data);
      return {
        version: data.version,
        deleted: data.deleted,
        serializedItem,
      };
    },
    priority: 0,
  },
  features: {
    namespace: VersionedDataKinds.Features.namespace,
    deserialize: (data: string): ItemDescriptor | undefined => {
      const flag = deserializeFlag(data);
      if (flag) {
        return {
          version: flag.version,
          item: flag,
        };
      }
      return undefined;
    },
    serialize: (data: any): SerializedItemDescriptor => {
      const serializedItem = serializeFlag(data);
      return {
        version: data.version,
        deleted: data.deleted,
        serializedItem,
      };
    },
    priority: 1,
  },
};
