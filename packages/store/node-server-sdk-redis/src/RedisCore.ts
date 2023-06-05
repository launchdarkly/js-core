import { interfaces } from '@launchdarkly/node-server-sdk';
import { Redis } from 'ioredis';

export default class RedisCore implements interfaces.PersistentDataStore {
  constructor(private readonly client: Redis) {}

  init(
    allData: interfaces.KindKeyedStore<interfaces.PersistentStoreDataKind>,
    callback: () => void
  ): void {
    throw new Error('Method not implemented.');
  }

  get(
    kind: interfaces.PersistentStoreDataKind,
    key: string,
    callback: (descriptor: interfaces.SerializedItemDescriptor | undefined) => void
  ): void {
    throw new Error('Method not implemented.');
  }

  getAll(
    kind: interfaces.PersistentStoreDataKind,
    callback: (
      descriptors: interfaces.KeyedItem<string, interfaces.SerializedItemDescriptor>[] | undefined
    ) => void
  ): void {
    throw new Error('Method not implemented.');
  }

  upsert(
    kind: interfaces.PersistentStoreDataKind,
    key: string,
    descriptor: interfaces.SerializedItemDescriptor,
    callback: (
      err?: Error | undefined,
      updatedDescriptor?: interfaces.SerializedItemDescriptor | undefined
    ) => void
  ): void {
    throw new Error('Method not implemented.');
  }

  initialized(callback: (isInitialized: boolean) => void): void {
    throw new Error('Method not implemented.');
  }

  close(): void {
    throw new Error('Method not implemented.');
  }

  getDescription(): string {
    return 'Redis';
  }
}
