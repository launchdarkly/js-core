import RedisFeatureStore from '../src/RedisFeatureStore';

//
import { AsyncStoreFacade } from '@launchdarkly/node-server-sdk';

describe('given a feature store', () => {
  let store: RedisFeatureStore;
  let facade: AsyncStoreFacade;


  beforeEach(() => {
    store = new RedisFeatureStore(undefined, undefined);
    facade = new AsyncStoreFacade(store);
  });

  afterEach(() => {
    store.close();
  });

  it('is initialized after calling init()', async () => {
    await facade.init({});
    const initialized = await facade.initialized();
    expect(initialized).toBeTruthy();
  });

  it('init() completely replaces previous data', async () => {
  });

  it('gets existing feature', async () => {
  });

  it('does not get nonexisting feature', async () => {
  });

  it('gets all features', async () => {
  });

  it('upserts with newer version', async () => {
  });

  it('does not upsert with older version', async () => {
  });

  it('upserts new feature', async () => {
  });

  it('handles upsert race condition within same client correctly', async () => {
  });

  it('deletes with newer version', async () => {
  });

  it('does not delete with older version', async () => {
  });

  it('allows deleting unknown feature', async () => {
  });

  it('does not upsert older version after delete', async () => {
  });

});