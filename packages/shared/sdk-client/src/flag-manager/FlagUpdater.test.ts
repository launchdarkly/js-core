import FlagStore from './FlagStore'
import { ItemDescriptor } from './ItemDescriptor';
import FlagUpdater from './FlagUpdater'
import { Context, LDLogger } from '@launchdarkly/js-sdk-common';
import { Flag } from '../types';

describe('FlagUpdater tests', () => {
  test('inits underlying flag store', async () => {
    // const mockStore : FlagStore = {
    //   init: jest.fn(),
    //   insertOrUpdate: jest.fn(),
    //   get: jest.fn(),
    //   getAll: jest.fn(),
    // }
    // const mockLogger: LDLogger = {
    //   error: jest.fn(),
    //   warn: jest.fn(),
    //   info: jest.fn(),
    //   debug: jest.fn(),
    // };
    // const context = Context.fromLDContext({ kind: 'user', key: 'user-key' })
    // const updateUnderTest = new FlagUpdater(mockStore, mockLogger)
    // updateUnderTest.init(context, {
    //   'flagA': {
    //     version: 1,
    //     flag: makeMockFlag()
    //   }
    // })
  });

  test('triggers callbacks on init', async () => {

  });

  test('init cached ignores active context', async () => {

  });

  test('upsert ignores inactive context', async () => {

  });

  test('upsert rejects data with old versions', async () => {

  });

  test('upsert updates underlying store', async () => {

  });

  test('upsert triggers callbacks', async () => {

  });

  test('on adds callbkac', async () => {

  });

  test('off removes callbkac', async () => {

  });

  test('off can be called many times safely', async () => {

  });
});

function makeMockFlag() : Flag {
  // the values of the flag object itself are not relevant for these tests, the
  // version on the item descriptor is what matters
  return {
    version: 0,
    flagVersion: 0,
    value: undefined,
    variation: 0,
    trackEvents: false,
  }
}