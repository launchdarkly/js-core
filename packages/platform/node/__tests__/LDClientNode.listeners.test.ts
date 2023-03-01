import { integrations } from '@launchdarkly/js-server-sdk-common';
import { LDClient } from '../src';
import LDClientNode from '../src/LDClientNode';

describe('given an LDClient with test data', () => {
  let client: LDClient;
  let td: integrations.TestData;

  beforeEach(() => {
    td = new integrations.TestData();
    client = new LDClientNode(
      'sdk-key',
      {
        updateProcessor: td.getFactory(),
        sendEvents: false,
      },
    );
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
    const expectedUpdates = [
      'flag1',
      'flag2',
      'flag1',
      'flag2',
    ];

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
    const expectedUpdates = [
      'flag1',
      'flag2',
      'flag1',
      'flag2',
    ];

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
});
