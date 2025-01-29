import { LDFeatureStore } from '../../src/api/subsystems';
import AsyncStoreFacade from '../../src/store/AsyncStoreFacade';
import InMemoryFeatureStore from '../../src/store/InMemoryFeatureStore';
import TransactionalPersistentStore from '../../src/store/TransactionalPersistentStore';
import VersionedDataKinds from '../../src/store/VersionedDataKinds';

describe('given a non transactional store', () => {
  let mockNontransactionalStore: LDFeatureStore;
  let transactionalStore: TransactionalPersistentStore;

  let nonTransactionalFacade: AsyncStoreFacade;
  let transactionalFacade: AsyncStoreFacade;

  beforeEach(() => {
    mockNontransactionalStore = new InMemoryFeatureStore();
    transactionalStore = new TransactionalPersistentStore(mockNontransactionalStore);

    // these two facades are used to make test writing easier
    nonTransactionalFacade = new AsyncStoreFacade(mockNontransactionalStore);
    transactionalFacade = new AsyncStoreFacade(transactionalStore);
  });

  afterEach(() => {
    transactionalFacade.close();
    jest.restoreAllMocks();
  });

  it('applies changes to non transactional store', async () => {
    await transactionalFacade.applyChanges(
      false,
      {
        features: {
          key1: {
            version: 2,
          },
        },
      },
      'selector1',
    );
    expect(await nonTransactionalFacade.all(VersionedDataKinds.Features)).toEqual({
      key1: {
        key: 'key1',
        version: 2,
      },
    });
    expect(await transactionalFacade.all(VersionedDataKinds.Features)).toEqual({
      key1: {
        key: 'key1',
        version: 2,
      },
    });
  });

  it('it reads through to non transactional store before basis is provided', async () => {
    await nonTransactionalFacade.init({
      features: {
        key1: {
          version: 1,
        },
      },
    });
    expect(await transactionalFacade.all(VersionedDataKinds.Features)).toEqual({
      key1: {
        version: 1,
      },
    });
  });

  it('it switches to memory store when basis is provided', async () => {
    // situate some mock data in non transactional store
    await nonTransactionalFacade.init({
      features: {
        nontransactionalFeature: {
          version: 1,
        },
      },
    });

    await transactionalFacade.applyChanges(
      true,
      {
        features: {
          key1: {
            version: 1,
          },
        },
      },
      'selector1',
    );

    expect(await nonTransactionalFacade.all(VersionedDataKinds.Features)).toEqual({
      key1: {
        version: 1,
      },
    });

    expect(await transactionalFacade.all(VersionedDataKinds.Features)).toEqual({
      key1: {
        version: 1,
      },
    });

    // corrupt non transactional store and then read from transactional store to prove it is not
    // using underlying non transactional store for reads
    await nonTransactionalFacade.init({
      features: {
        nontransactionalFeature: {
          version: 1,
        },
      },
    });

    // still should read from memory
    expect(await transactionalFacade.all(VersionedDataKinds.Features)).toEqual({
      key1: {
        version: 1,
      },
    });
  });
});
