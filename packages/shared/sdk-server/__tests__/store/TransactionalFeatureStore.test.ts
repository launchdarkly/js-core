import { LDTransactionalFeatureStore } from '../../src/api/subsystems';
import AsyncTransactionalStoreFacade from '../../src/store/AsyncTransactionalStoreFacade';
import InMemoryFeatureStore from '../../src/store/InMemoryFeatureStore';
import TransactionalFeatureStore from '../../src/store/TransactionalFeatureStore';
import VersionedDataKinds from '../../src/store/VersionedDataKinds';

describe('given a non transactional store', () => {
  let mockNontransactionalStore: LDTransactionalFeatureStore;
  let transactionalStore: TransactionalFeatureStore;

  let nonTransactionalFacade: AsyncTransactionalStoreFacade;
  let transactionalFacade: AsyncTransactionalStoreFacade;

  beforeEach(() => {
    mockNontransactionalStore = new InMemoryFeatureStore();
    transactionalStore = new TransactionalFeatureStore(mockNontransactionalStore);

    // these two facades are used to make test writing easier
    nonTransactionalFacade = new AsyncTransactionalStoreFacade(mockNontransactionalStore);
    transactionalFacade = new AsyncTransactionalStoreFacade(transactionalStore);
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
          key2: {
            version: 3,
          },
        },
        segments: {
          seg1: {
            version: 4,
          },
          seg2: {
            version: 5,
          },
        },
      },
      undefined,
      'selector1',
    );
    expect(await nonTransactionalFacade.all(VersionedDataKinds.Features)).toEqual({
      key1: {
        key: 'key1',
        version: 2,
      },
      key2: {
        key: 'key2',
        version: 3,
      },
    });
    expect(await nonTransactionalFacade.all(VersionedDataKinds.Segments)).toEqual({
      seg1: {
        key: 'seg1',
        version: 4,
      },
      seg2: {
        key: 'seg2',
        version: 5,
      },
    });
    expect(await transactionalFacade.all(VersionedDataKinds.Features)).toEqual({
      key1: {
        key: 'key1',
        version: 2,
      },
      key2: {
        key: 'key2',
        version: 3,
      },
    });
    expect(await transactionalFacade.all(VersionedDataKinds.Segments)).toEqual({
      seg1: {
        key: 'seg1',
        version: 4,
      },
      seg2: {
        key: 'seg2',
        version: 5,
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
      undefined,
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
