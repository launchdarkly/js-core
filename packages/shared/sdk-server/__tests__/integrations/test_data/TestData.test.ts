import {
  ClientContext,
  EventName,
  internal,
  ProcessStreamResponse,
} from '@launchdarkly/js-sdk-common';

import { LDFeatureStore } from '../../../src';
import { Flag } from '../../../src/evaluation/data/Flag';
import TestData from '../../../src/integrations/test_data/TestData';
import Configuration from '../../../src/options/Configuration';
import AsyncStoreFacade from '../../../src/store/AsyncStoreFacade';
import InMemoryFeatureStore from '../../../src/store/InMemoryFeatureStore';
import { AllData, deserializeAll } from '../../../src/store/serialization';
import VersionedDataKinds from '../../../src/store/VersionedDataKinds';

const { mocks } = internal;

const basicBooleanFlag: Flag = {
  fallthrough: {
    variation: 0,
  },
  key: 'new-flag',
  offVariation: 1,
  on: true,
  variations: [true, false],
  version: 1,
};

const createPutListener = (featureStore: LDFeatureStore) => ({
  deserializeData: deserializeAll,
  processJson: async ({ data: { flags, segments } }: AllData) => {
    const initData = {
      [VersionedDataKinds.Features.namespace]: flags,
      [VersionedDataKinds.Segments.namespace]: segments,
    };
    await featureStore.init(initData, () => '');
  },
});

const createStreamListeners = (featureStore: LDFeatureStore) => {
  const listeners = new Map<EventName, ProcessStreamResponse>();
  listeners.set('put', createPutListener(featureStore));
  listeners.set('patch', { deserializeData: jest.fn(), processJson: jest.fn() });
  listeners.set('delete', { deserializeData: jest.fn(), processJson: jest.fn() });
  return listeners;
};

describe('TestData', () => {
  let listeners: Map<EventName, ProcessStreamResponse>;

  beforeEach(() => {
    // listeners = createStreamListeners();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('initializes the data store with flags configured when the data store is created', async () => {
    const td = new TestData();
    td.update(td.flag('new-flag').variationForAll(true));

    const store = new InMemoryFeatureStore();
    listeners = createStreamListeners(store);
    const processor = td.getFactory()(
      new ClientContext('', new Configuration({}), mocks.basicPlatform),
      store,
      listeners,
    );
    processor.start();
    const facade = new AsyncStoreFacade(store);
    const res = await facade.get(VersionedDataKinds.Features, 'new-flag');

    expect(res).toEqual(basicBooleanFlag);
  });

  //   it('updates the data store when update is called', async () => {
  //     const td = new TestData();
  //     const store = new InMemoryFeatureStore();
  //     const processor = td.getFactory()(
  //       new ClientContext('', new Configuration({}), mocks.basicPlatform),
  //       store,
  //       listeners,
  //     );
  //
  //     processor.start();
  //     const facade = new AsyncStoreFacade(store);
  //
  //     // In this test the update is after initialization.
  //     await td.update(td.flag('new-flag').variationForAll(true));
  //     const res = await facade.get(VersionedDataKinds.Features, 'new-flag');
  //     expect(res).toEqual(basicBooleanFlag);
  //   });
  //
  //   it('can include pre-configured items', async () => {
  //     const td = new TestData();
  //     td.usePreconfiguredFlag({ key: 'my-flag', version: 1000, on: true });
  //     td.usePreconfiguredSegment({ key: 'my-segment', version: 2000 });
  //
  //     const store = new InMemoryFeatureStore();
  //     const processor = td.getFactory()(
  //       new ClientContext('', new Configuration({}), mocks.basicPlatform),
  //       store,
  //       listeners,
  //     );
  //
  //     processor.start();
  //
  //     td.usePreconfiguredFlag({ key: 'my-flag', on: false });
  //     td.usePreconfiguredFlag({ key: 'my-flag-2', version: 1000, on: true });
  //     td.usePreconfiguredSegment({ key: 'my-segment', included: ['x'] });
  //     td.usePreconfiguredSegment({ key: 'my-segment-2', version: 2000 });
  //
  //     const facade = new AsyncStoreFacade(store);
  //     const allFlags = await facade.all(VersionedDataKinds.Features);
  //     const allSegments = await facade.all(VersionedDataKinds.Segments);
  //
  //     expect(allFlags).toEqual({
  //       'my-flag': {
  //         key: 'my-flag',
  //         on: false,
  //         version: 1001,
  //       },
  //       'my-flag-2': {
  //         key: 'my-flag-2',
  //         on: true,
  //         version: 1000,
  //       },
  //     });
  //
  //     expect(allSegments).toEqual({
  //       'my-segment': {
  //         included: ['x'],
  //         key: 'my-segment',
  //         version: 2001,
  //       },
  //       'my-segment-2': {
  //         key: 'my-segment-2',
  //         version: 2000,
  //       },
  //     });
  //   });
  //
  //   it.each([true, false])('does not update the store after stop/close is called', async (stop) => {
  //     const td = new TestData();
  //
  //     const store = new InMemoryFeatureStore();
  //     const processor = td.getFactory()(
  //       new ClientContext('', new Configuration({}), mocks.basicPlatform),
  //       store,
  //       listeners,
  //     );
  //
  //     processor.start();
  //     td.update(td.flag('new-flag').variationForAll(true));
  //     if (stop) {
  //       processor.stop();
  //     } else {
  //       processor.close();
  //     }
  //     td.update(td.flag('new-flag-2').variationForAll(true));
  //
  //     const facade = new AsyncStoreFacade(store);
  //
  //     const flag1 = await facade.get(VersionedDataKinds.Features, 'new-flag');
  //     const flag2 = await facade.get(VersionedDataKinds.Features, 'new-flag-2');
  //
  //     expect(flag1).toBeDefined();
  //     expect(flag2).toBeNull();
  //   });
  //
  //   it('can update a flag that already exists in the store', async () => {
  //     const td = new TestData();
  //
  //     const store = new InMemoryFeatureStore();
  //
  //     const processor = td.getFactory()(
  //       new ClientContext('', new Configuration({}), mocks.basicPlatform),
  //       store,
  //       listeners,
  //     );
  //
  //     processor.start();
  //     td.update(td.flag('new-flag').variationForAll(true));
  //     td.update(td.flag('new-flag').variationForAll(false));
  //
  //     const facade = new AsyncStoreFacade(store);
  //     const res = (await facade.get(VersionedDataKinds.Features, 'new-flag')) as Flag;
  //     expect(res.version).toEqual(2);
  //     expect(res.fallthrough.variation).toEqual(1);
  //   });
  // });
  //
  // describe('given a TestData instance', () => {
  //   let td: TestData;
  //   beforeEach(() => {
  //     td = new TestData();
  //   });
  //
  //   it("doesn't provide the same reference when updating an existing builder", () => {
  //     const flag = td.flag('test-flag');
  //     td.update(flag);
  //     const flagCopy = td.flag('test-flag');
  //     flagCopy.on(false);
  //     expect(flagCopy).not.toEqual(flag);
  //   });
  //
  //   it('can clone a complex flag configuration', () => {
  //     const flag = td
  //       .flag('test-flag')
  //       .offVariation(true)
  //       .variationForAll(false)
  //       .variationForUser('billy', true)
  //       .ifMatch('user', 'name', 'ben', 'christian')
  //       .andNotMatch('user', 'country', 'fr')
  //       .thenReturn(true);
  //
  //     td.update(flag);
  //     const flagCopy = td.flag('test-flag');
  //
  //     const flagRules: FlagRule[] = [
  //       {
  //         id: 'rule0',
  //         variation: 0,
  //         clauses: [
  //           {
  //             attribute: 'name',
  //             attributeReference: new AttributeReference('name'),
  //             contextKind: 'user',
  //             negate: false,
  //             op: 'in',
  //             values: ['ben', 'christian'],
  //           },
  //           {
  //             contextKind: 'user',
  //             attribute: 'country',
  //             attributeReference: new AttributeReference('country'),
  //             negate: true,
  //             op: 'in',
  //             values: ['fr'],
  //           },
  //         ],
  //       },
  //     ];
  //
  //     const builtFlag = flagCopy.build(1);
  //     expect(builtFlag.fallthrough).toEqual({ variation: 1 });
  //     expect(builtFlag.offVariation).toEqual(0);
  //     expect(builtFlag.variations).toEqual([true, false]);
  //     expect(builtFlag.contextTargets).toEqual([
  //       { contextKind: 'user', values: ['billy'], variation: 0 },
  //     ]);
  //     expect(builtFlag.rules).toEqual(flagRules);
  //   });
  //
  //   it('defaults a new flag to on', () => {
  //     expect(td.flag('whatever').build(0).on).toBe(true);
  //   });
  //
  //   it('defaults a new flag builder to a boolean flag', () => {
  //     const flag = td.flag('test-flag-booleanFlags').build(1);
  //     flag.variations.every((val) => expect(typeof val).toBe('boolean'));
  //     expect(flag.variations[1]).not.toEqual(flag.variations[0]);
  //     expect(flag.variations.length).toBe(2);
  //   });
  //
  //   it('can set variations on the flag builder', () => {
  //     const flag = td.flag('test-flag');
  //     flag.variations('a', 'b');
  //     expect(flag.build(0).variations).toEqual(['a', 'b']);
  //   });
  //
  //   it('can set a value for all', () => {
  //     const flag = td.flag('test-flag');
  //     flag.valueForAll('potato');
  //     const built = flag.build(1);
  //     expect(built.variations).toEqual(['potato']);
  //     expect(built.fallthrough.variation).toEqual(0);
  //   });
  //
  //   it('can handle boolean values for *Variation setters', () => {
  //     const flag = td.flag('test-flag').fallthroughVariation(false);
  //     expect(flag.build(0).fallthrough).toEqual({ variation: 1 });
  //
  //     const offFlag = td.flag('off-flag').offVariation(true);
  //     expect(offFlag.build(0).fallthrough).toEqual({ variation: 0 });
  //   });
  //
  //   it('can set boolean values for a specific user target', () => {
  //     const flag = td.flag('test-flag').variationForContext('user', 'potato', false);
  //     const flag2 = td.flag('test-flag').variationForUser('potato', true);
  //     expect(flag.build(0).contextTargets).toEqual([
  //       {
  //         contextKind: 'user',
  //         variation: 1,
  //         values: ['potato'],
  //       },
  //     ]);
  //     expect(flag2.build(0).contextTargets).toEqual([
  //       {
  //         contextKind: 'user',
  //         variation: 0,
  //         values: ['potato'],
  //       },
  //     ]);
  //   });
  //
  //   it('can clear targets', () => {
  //     const flag = td.flag('test-flag').variationForContext('user', 'potato', false);
  //     const clearedFlag = flag.clone().clearAllTargets();
  //     expect(clearedFlag.build(0)).not.toHaveProperty('targets');
  //   });
  //
  //   it('can make not matching rules', () => {
  //     const flag = td.flag('flag').ifNotMatch('user', 'name', 'Saffron', 'Bubble').thenReturn(true);
  //
  //     expect(flag.build(1)).toEqual({
  //       fallthrough: {
  //         variation: 0,
  //       },
  //       key: 'flag',
  //       offVariation: 1,
  //       on: true,
  //       rules: [
  //         {
  //           clauses: [
  //             {
  //               attribute: 'name',
  //               attributeReference: {
  //                 components: ['name'],
  //                 isValid: true,
  //                 redactionName: 'name',
  //               },
  //               contextKind: 'user',
  //               negate: true,
  //               op: 'in',
  //               values: ['Saffron', 'Bubble'],
  //             },
  //           ],
  //           id: 'rule0',
  //           variation: 0,
  //         },
  //       ],
  //       variations: [true, false],
  //       version: 1,
  //     });
  //   });
  //
  //   it('can add and remove a rule', () => {
  //     const flag = td
  //       .flag('test-flag')
  //       .ifMatch('user', 'name', 'ben', 'christian')
  //       .andNotMatch('user', 'country', 'fr')
  //       .thenReturn(true);
  //
  //     const flagRules: FlagRule[] = [
  //       {
  //         id: 'rule0',
  //         variation: 0,
  //         clauses: [
  //           {
  //             attribute: 'name',
  //             attributeReference: new AttributeReference('name'),
  //             contextKind: 'user',
  //             negate: false,
  //             op: 'in',
  //             values: ['ben', 'christian'],
  //           },
  //           {
  //             contextKind: 'user',
  //             attribute: 'country',
  //             attributeReference: new AttributeReference('country'),
  //             negate: true,
  //             op: 'in',
  //             values: ['fr'],
  //           },
  //         ],
  //       },
  //     ];
  //
  //     expect(flag.build(1).rules).toEqual(flagRules);
  //
  //     const clearedRulesFlag = flag.clearRules();
  //     expect(clearedRulesFlag.build(0)).not.toHaveProperty('rules');
  //   });
  //
  //   it('can move a targeted context from one variation to another', () => {
  //     const flag = td
  //       .flag('test-flag')
  //       .variationForContext('user', 'ben', false)
  //       .variationForContext('user', 'ben', true);
  //     // Because there was only one target in the first variation there will be only
  //     // a single variation after that target is removed.
  //     expect(flag.build(1).contextTargets).toEqual([
  //       {
  //         contextKind: 'user',
  //         variation: 0,
  //         values: ['ben'],
  //       },
  //     ]);
  //   });
  //
  //   it('if a targeted context is moved from one variation to another, then other targets remain for that variation', () => {
  //     const flag = td
  //       .flag('test-flag')
  //       .variationForContext('user', 'ben', false)
  //       .variationForContext('user', 'joe', false)
  //       .variationForContext('user', 'ben', true);
  //
  //     expect(flag.build(1).contextTargets).toEqual([
  //       {
  //         contextKind: 'user',
  //         variation: 0,
  //         values: ['ben'],
  //       },
  //       {
  //         contextKind: 'user',
  //         variation: 1,
  //         values: ['joe'],
  //       },
  //     ]);
  //   });
  //
  //   it('should allow targets from multiple contexts in the same variation', () => {
  //     const flag = td
  //       .flag('test-flag')
  //       .variationForContext('user', 'ben', false)
  //       .variationForContext('potato', 'russet', false)
  //       .variationForContext('potato', 'yukon', false);
  //     // Because there was only one target in the first variation there will be only
  //     // a single variation after that target is removed.
  //     expect(flag.build(0).contextTargets).toEqual([
  //       {
  //         contextKind: 'user',
  //         variation: 1,
  //         values: ['ben'],
  //       },
  //       {
  //         contextKind: 'potato',
  //         variation: 1,
  //         values: ['russet', 'yukon'],
  //       },
  //     ]);
  //   });
});
