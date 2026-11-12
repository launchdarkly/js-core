import { ClientContext, subsystem } from '@launchdarkly/js-sdk-common';

import TestData from '../../../src/integrations/test_data/TestData';
import Configuration from '../../../src/options/Configuration';
import AsyncStoreFacade from '../../../src/store/AsyncStoreFacade';
import InMemoryFeatureStore from '../../../src/store/InMemoryFeatureStore';
import VersionedDataKinds from '../../../src/store/VersionedDataKinds';
import { createBasicPlatform } from '../../createBasicPlatform';

it('sends the current flags and segments as a full payload when a synchronizer starts', () => {
  const td = new TestData();
  td.update(td.flag('flag1').variationForAll(true));
  td.usePreconfiguredSegment({ key: 'segment1', version: 3, included: ['user1'] });
  const dataCallback = jest.fn();
  const statusCallback = jest.fn();

  // Start a synchronizer.
  td.createFDv2Source('synchronizer').start(dataCallback, statusCallback);

  // The synchronizer is valid and sends all current data as one full payload. The payload
  // carries a selector, so it is a basis.
  expect(statusCallback).toHaveBeenCalledWith(subsystem.DataSourceState.Valid);
  expect(dataCallback).toHaveBeenCalledTimes(1);
  expect(dataCallback).toHaveBeenCalledWith(true, {
    payload: {
      version: 2,
      state: '2',
      type: 'full',
      updates: [
        {
          kind: 'flag',
          key: 'flag1',
          version: 1,
          object: expect.objectContaining({
            key: 'flag1',
            on: true,
            fallthrough: { variation: 0 },
          }),
        },
        {
          kind: 'segment',
          key: 'segment1',
          version: 3,
          object: expect.objectContaining({ key: 'segment1', included: ['user1'] }),
        },
      ],
    },
  });
});

it('sends the current data one time and closes when used as an initializer', () => {
  const td = new TestData();
  td.update(td.flag('flag1').variationForAll(true));
  const dataCallback = jest.fn();
  const statusCallback = jest.fn();

  // Start an initializer, then change the test data.
  td.createFDv2Source('initializer').start(dataCallback, statusCallback);
  td.update(td.flag('flag2').variationForAll(true));

  // The initializer sends only the data present at start, as one full payload with a
  // selector, and then closes.
  expect(dataCallback).toHaveBeenCalledTimes(1);
  expect(dataCallback).toHaveBeenCalledWith(true, {
    payload: expect.objectContaining({
      type: 'full',
      state: '1',
      updates: [expect.objectContaining({ kind: 'flag', key: 'flag1' })],
    }),
  });
  expect(statusCallback).toHaveBeenLastCalledWith(subsystem.DataSourceState.Closed);
});

it('ignores a second start call on a started source', () => {
  const td = new TestData();
  const source = td.createFDv2Source('synchronizer');
  const dataCallback = jest.fn();
  const secondDataCallback = jest.fn();

  // Start the same source two times.
  source.start(dataCallback, jest.fn());
  source.start(secondDataCallback, jest.fn());

  // Only the first start sends data.
  expect(dataCallback).toHaveBeenCalledTimes(1);
  expect(secondDataCallback).not.toHaveBeenCalled();
});

it('sends a change payload for each flag update after a synchronizer starts', () => {
  const td = new TestData();
  const dataCallback = jest.fn();
  td.createFDv2Source('synchronizer').start(dataCallback, jest.fn());

  // Add a flag and then change it.
  td.update(td.flag('flag1').variationForAll(true));
  td.update(td.flag('flag1').variationForAll(false));

  // Each update is one change payload. The full payload and each change payload carry the
  // next selector number.
  expect(dataCallback).toHaveBeenCalledTimes(3);
  const [, [firstBasis, first], [secondBasis, second]] = dataCallback.mock.calls;
  expect(firstBasis).toBe(false);
  expect(first).toEqual({
    payload: {
      version: 1,
      state: '1',
      type: 'partial',
      updates: [
        {
          kind: 'flag',
          key: 'flag1',
          version: 1,
          object: expect.objectContaining({ fallthrough: { variation: 0 } }),
        },
      ],
    },
  });
  expect(secondBasis).toBe(false);
  expect(second).toEqual({
    payload: {
      version: 2,
      state: '2',
      type: 'partial',
      updates: [
        {
          kind: 'flag',
          key: 'flag1',
          version: 2,
          object: expect.objectContaining({ fallthrough: { variation: 1 } }),
        },
      ],
    },
  });
});

it('numbers the selector of every payload in order, across full and partial payloads', () => {
  const td = new TestData();
  const dataCallback = jest.fn();
  td.createFDv2Source('synchronizer').start(dataCallback, jest.fn());

  // Make a change, and then start another synchronizer of the same test data.
  td.update(td.flag('flag1').variationForAll(true));
  const secondDataCallback = jest.fn();
  td.createFDv2Source('synchronizer').start(secondDataCallback, jest.fn());

  // Every payload that the test data makes, full or partial, carries the next selector
  // number.
  const selectors = dataCallback.mock.calls.map(([, data]) => data.payload.state);
  expect(selectors).toEqual(['0', '1']);
  expect(secondDataCallback).toHaveBeenCalledWith(true, {
    payload: expect.objectContaining({ type: 'full', version: 2, state: '2' }),
  });
});

it('sends a change payload for a preconfigured flag and a preconfigured segment', () => {
  const td = new TestData();
  const dataCallback = jest.fn();
  td.createFDv2Source('synchronizer').start(dataCallback, jest.fn());

  // Add a preconfigured flag and a preconfigured segment.
  td.usePreconfiguredFlag({
    key: 'pre-flag',
    version: 10,
    on: true,
    fallthrough: { variation: 0 },
    variations: ['a'],
  });
  td.usePreconfiguredSegment({ key: 'pre-segment', version: 20, included: ['user1'] });

  // Each item is one change payload that keeps the item version.
  expect(dataCallback).toHaveBeenCalledTimes(3);
  expect(dataCallback).toHaveBeenNthCalledWith(2, false, {
    payload: expect.objectContaining({
      type: 'partial',
      updates: [
        {
          kind: 'flag',
          key: 'pre-flag',
          version: 10,
          object: expect.objectContaining({ key: 'pre-flag', variations: ['a'] }),
        },
      ],
    }),
  });
  expect(dataCallback).toHaveBeenNthCalledWith(3, false, {
    payload: expect.objectContaining({
      type: 'partial',
      updates: [
        {
          kind: 'segment',
          key: 'pre-segment',
          version: 20,
          object: expect.objectContaining({ key: 'pre-segment', included: ['user1'] }),
        },
      ],
    }),
  });
});

it('sends version 1 and then the next version for a preconfigured flag that has no version', () => {
  const td = new TestData();
  const dataCallback = jest.fn();
  td.createFDv2Source('synchronizer').start(dataCallback, jest.fn());

  // Add a flag that has no version, and then replace it without a version.
  td.usePreconfiguredFlag({ key: 'flag1', on: true });
  td.usePreconfiguredFlag({ key: 'flag1', on: false });

  // Each change payload carries the version that the data store requires.
  expect(dataCallback).toHaveBeenNthCalledWith(2, false, {
    payload: expect.objectContaining({
      type: 'partial',
      updates: [
        {
          kind: 'flag',
          key: 'flag1',
          version: 1,
          object: expect.objectContaining({ key: 'flag1', on: true }),
        },
      ],
    }),
  });
  expect(dataCallback).toHaveBeenNthCalledWith(3, false, {
    payload: expect.objectContaining({
      type: 'partial',
      updates: [
        {
          kind: 'flag',
          key: 'flag1',
          version: 2,
          object: expect.objectContaining({ key: 'flag1', on: false }),
        },
      ],
    }),
  });
});

it('sends a preconfigured flag version that is greater than the current version', () => {
  const td = new TestData();
  const dataCallback = jest.fn();
  td.createFDv2Source('synchronizer').start(dataCallback, jest.fn());

  // Add a flag, and then replace it with a greater version.
  td.usePreconfiguredFlag({ key: 'flag1', on: true, version: 1 });
  td.usePreconfiguredFlag({ key: 'flag1', on: false, version: 100 });

  // The change payload keeps the greater version.
  expect(dataCallback).toHaveBeenNthCalledWith(3, false, {
    payload: expect.objectContaining({
      type: 'partial',
      updates: [
        {
          kind: 'flag',
          key: 'flag1',
          version: 100,
          object: expect.objectContaining({ key: 'flag1', on: false }),
        },
      ],
    }),
  });
});

it('sends version 1 and then the next version for a preconfigured segment that has no version', () => {
  const td = new TestData();
  const dataCallback = jest.fn();
  td.createFDv2Source('synchronizer').start(dataCallback, jest.fn());

  // Add a segment that has no version, and then replace it without a version.
  td.usePreconfiguredSegment({ key: 'segment1', included: ['user1'] });
  td.usePreconfiguredSegment({ key: 'segment1', included: ['user2'] });

  // Each change payload carries the version that the data store requires.
  expect(dataCallback).toHaveBeenNthCalledWith(2, false, {
    payload: expect.objectContaining({
      type: 'partial',
      updates: [
        {
          kind: 'segment',
          key: 'segment1',
          version: 1,
          object: expect.objectContaining({ key: 'segment1', included: ['user1'] }),
        },
      ],
    }),
  });
  expect(dataCallback).toHaveBeenNthCalledWith(3, false, {
    payload: expect.objectContaining({
      type: 'partial',
      updates: [
        {
          kind: 'segment',
          key: 'segment1',
          version: 2,
          object: expect.objectContaining({ key: 'segment1', included: ['user2'] }),
        },
      ],
    }),
  });
});

it('sends each change to every started synchronizer of the same TestData', () => {
  const td = new TestData();
  const firstClientData = jest.fn();
  const secondClientData = jest.fn();
  td.createFDv2Source('synchronizer').start(firstClientData, jest.fn());
  td.createFDv2Source('synchronizer').start(secondClientData, jest.fn());

  // Update a flag one time.
  td.update(td.flag('flag1').variationForAll(true));

  // Both synchronizers get the same change payload.
  expect(firstClientData).toHaveBeenCalledTimes(2);
  expect(secondClientData).toHaveBeenCalledTimes(2);
  const [, firstChange] = firstClientData.mock.calls[1];
  const [, secondChange] = secondClientData.mock.calls[1];
  expect(firstChange.payload).toMatchObject({
    type: 'partial',
    updates: [{ kind: 'flag', key: 'flag1' }],
  });
  expect(secondChange).toEqual(firstChange);
});

it('stops sending changes to a synchronizer after it stops', () => {
  const td = new TestData();
  const stoppedData = jest.fn();
  const activeData = jest.fn();
  const stopped = td.createFDv2Source('synchronizer');
  stopped.start(stoppedData, jest.fn());
  td.createFDv2Source('synchronizer').start(activeData, jest.fn());

  // Stop one synchronizer, then update a flag.
  stopped.stop();
  td.update(td.flag('flag1').variationForAll(true));

  // Only the synchronizer that is still active gets the change.
  expect(stoppedData).toHaveBeenCalledTimes(1);
  expect(activeData).toHaveBeenCalledTimes(2);
});

it('sends an update to FDv1 and FDv2 clients that use the same TestData', async () => {
  const td = new TestData();
  const store = new InMemoryFeatureStore();
  const processor = td.getFactory()(
    new ClientContext('', new Configuration({}), createBasicPlatform()),
    store,
    jest.fn(),
  );
  processor.start();
  const dataCallback = jest.fn();
  td.createFDv2Source('synchronizer').start(dataCallback, jest.fn());

  // Update a flag.
  await td.update(td.flag('flag1').variationForAll(true));

  // The FDv1 store and the FDv2 synchronizer both get the flag.
  const stored = await new AsyncStoreFacade(store).get(VersionedDataKinds.Features, 'flag1');
  expect(stored).toMatchObject({ key: 'flag1', version: 1 });
  expect(dataCallback).toHaveBeenLastCalledWith(false, {
    payload: expect.objectContaining({
      updates: [expect.objectContaining({ key: 'flag1', version: 1 })],
    }),
  });
});
