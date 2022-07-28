import { LDFeatureStoreDataStorage } from '../../src/api/subsystems';
import sortDataSet from '../../src/store/sortDataSet';

const dataToSort: LDFeatureStoreDataStorage = {
  features: {
    d: {
      version: 1
    },
    a: {
      version: 2,
      prerequisites: [{key: 'c'}, {key: 'b'}]
    },
    e: {
      version: 3,
      prerequisites: [{key: 'a'}, {key: 'c'}]
    },
    b: {
      version: 4,
    },
    c: {
      version: 5,
      prerequisites: [{key: 'b'}]
    }
  },
  segments: {
    f: {
      version: 6
    },
    g: {
      version: 7
    }
  }
};

it('sorts data by dependencies', () => {
  const sorted = sortDataSet(dataToSort);
  expect(sorted[0].key.namespace).toEqual('segments');
  expect(sorted[1].key.namespace).toEqual('features');

  expect(sorted[0].item.map(item => item.key)).toEqual(['f', 'g']);
  expect(sorted[1].item.map(item => item.key)).toEqual(['d', 'b', 'c', 'a', 'e']);
});