import { integrations, LDLogger } from '@launchdarkly/js-server-sdk-common';

import { Context, LDClient } from '../src';
import LDClientNode from '../src/LDClientNode';

let logger: LDLogger;

beforeEach(() => {
  logger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
});
describe('given an LDClient with test data', () => {
  let client: LDClient;
  let td: integrations.TestData;

  beforeEach(() => {
    td = new integrations.TestData();
    client = new LDClientNode('sdk-key', {
      updateProcessor: td.getFactory(),
      sendEvents: false,
      logger,
    });
  });

  afterEach(() => {
    client.close();
  });

  it('sends an "update" event when a flag is added', (done) => {
    client.on('update', (params) => {
      expect(params.key).toEqual('new-flag');
      done();
    });
    td.update(td.flag('new-flag'));
  });

  it('sends an "update:new-flag" event when a flag is added', (done) => {
    client.on('update:new-flag', (params) => {
      expect(params.key).toEqual('new-flag');
      done();
    });
    td.update(td.flag('new-flag'));
  });

  it('sends an "update" when a flag is updated', (done) => {
    const expectedUpdates = ['flag1', 'flag2', 'flag1', 'flag2'];

    client.on('update', (params) => {
      expect(expectedUpdates.includes(params.key)).toBeTruthy();
      expectedUpdates.splice(expectedUpdates.indexOf(params.key), 1);
      if (expectedUpdates.length === 0) {
        done();
      }
    });

    td.update(td.flag('flag1').on(true));
    td.update(td.flag('flag2').on(true));

    td.update(td.flag('flag1').on(false));
    td.update(td.flag('flag2').on(false));
  });

  it('sends an "update:<flag-key>" when a flag is updated', (done) => {
    const expectedUpdates = ['flag1', 'flag2', 'flag1', 'flag2'];

    client.on('update:flag1', (params) => {
      expect(expectedUpdates.includes(params.key)).toBeTruthy();
      expectedUpdates.splice(expectedUpdates.indexOf(params.key), 1);
      if (expectedUpdates.length === 0) {
        done();
      }
    });

    client.on('update:flag2', (params) => {
      expect(expectedUpdates.includes(params.key)).toBeTruthy();
      expectedUpdates.splice(expectedUpdates.indexOf(params.key), 1);
      if (expectedUpdates.length === 0) {
        done();
      }
    });

    td.update(td.flag('flag1').on(true));
    td.update(td.flag('flag2').on(true));

    td.update(td.flag('flag1').on(false));
    td.update(td.flag('flag2').on(false));
  });

  it('logs errors when there are no event handlers', () => {
    // Empty kind is not valid.
    const invalidContext = { key: 'key', kind: '' };
    client.variation('flag', { key: 'key', kind: '' }, false);
    const referenceContext = Context.fromLDContext(invalidContext);
    expect(referenceContext.message).toBeDefined();
    expect(logger.error).toHaveBeenNthCalledWith(
      1,
      `${referenceContext.message} returning default value.`,
    );
  });
});
