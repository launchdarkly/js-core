import { LDClientImpl } from '../../../src';
import TestData from '../../../src/integrations/test_data/TestData';
import InMemoryFeatureStore from '../../../src/store/InMemoryFeatureStore';

it('initializes the datastore with flags configured before the client is started', () => {
  const td = new TestData();
  td.update(td.flag('new-flag').variationForAll(true));

  const store = new InMemoryFeatureStore();
  // const client = new LDClientImpl('sdk_key', { offline: true, featureStore: store, updateProcessor: td });
});