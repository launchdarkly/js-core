import { DefaultFlagStore } from '../../src/flag-manager/FlagStore';

describe('given an empty flag store', () => {
  let store: DefaultFlagStore;

  beforeEach(() => {
    store = new DefaultFlagStore();
  });

  it.each(['unknown', 'toString', 'length'])(
    'gets undefined for a feature that does not exist',
    (key) => {
      expect(store.get(key)).toBeUndefined();
    },
  );

  it('can set and get key', () => {
    store.insertOrUpdate('toString', {
      version: 1,
      flag: {
        version: 1,
        flagVersion: 1,
        value: 'test-value',
        variation: 0,
        trackEvents: false,
      },
    });

    expect(store.get('toString')?.flag.value).toEqual('test-value');
  });

  it('replaces flags on init', () => {
    store.insertOrUpdate('potato', {
      version: 1,
      flag: {
        version: 1,
        flagVersion: 1,
        value: 'test-value',
        variation: 0,
        trackEvents: false,
      },
    });

    store.init({
      newFlag: {
        version: 1,
        flag: {
          version: 1,
          flagVersion: 1,
          value: 'new-test-value',
          variation: 0,
          trackEvents: false,
        },
      },
    });

    const all = store.getAll();
    expect(Object.keys(all)).toEqual(['newFlag']);
  });
});
