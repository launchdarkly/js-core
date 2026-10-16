/* eslint-disable no-underscore-dangle */
// The override marker outside the evaluator: the all-flags state reports the indicator only
// when true, every ingest path strips a marker that arrives from outside, and the serializers
// never emit it while leaving nested keys of the same name untouched.
import { subsystem } from '@launchdarkly/js-sdk-common';

import { LDClientImpl } from '../src';
import TestData from '../src/integrations/test_data/TestData';
import AsyncStoreFacade from '../src/store/AsyncStoreFacade';
import InMemoryFeatureStore from '../src/store/InMemoryFeatureStore';
import { persistentStoreKinds } from '../src/store/persistentStoreKinds';
import {
  deserializeAll,
  deserializePatch,
  processSegment,
  serializeFlag,
  serializeSegment,
} from '../src/store/serialization';
import VersionedDataKinds from '../src/store/VersionedDataKinds';
import { createBasicPlatform } from './createBasicPlatform';
import makeCallbacks from './makeCallbacks';

const user = { key: 'userkey' };

// Never initializes, so the client serves last known values from the initialized store.
const inertFactory = (): subsystem.LDStreamProcessor => ({
  start: () => {},
  stop: () => {},
  close: () => {},
});

function stringFlag(key: string, value: string, marked: boolean): any {
  return {
    key,
    version: 1,
    on: true,
    fallthrough: { variation: 0 },
    offVariation: 0,
    variations: [value],
    ...(marked ? { _sdk_override: true } : {}),
  };
}

describe('given a client whose store holds marked definitions', () => {
  let client: LDClientImpl;

  beforeEach(async () => {
    const store = new InMemoryFeatureStore();
    // Simulates what the #2051 override layer hands evaluation: a marked definition.
    await new AsyncStoreFacade(store).init({
      [VersionedDataKinds.Features.namespace]: {
        str: stringFlag('str', 'a-string', true),
        mig: stringFlag('mig', 'not-a-stage', true),
        plain: stringFlag('plain', 'x', false),
      },
      [VersionedDataKinds.Segments.namespace]: {},
    });
    client = new LDClientImpl(
      'sdk-key-proof',
      createBasicPlatform(),
      { updateProcessor: inertFactory, sendEvents: false, featureStore: store },
      makeCallbacks(false),
    );
  });

  afterEach(() => client.close());

  it('marks the detail of a marked flag', async () => {
    const d = await client.variationDetail('str', user, 'def');
    expect(d.reason).toEqual({ kind: 'FALLTHROUGH', overrideAffected: true });
  });

  it('allFlagsState JSON carries the indicator only when true', async () => {
    const json = (await client.allFlagsState(user, { withReasons: true })).toJSON() as any;
    expect(json.$flagsState.str.reason).toEqual({ kind: 'FALLTHROUGH', overrideAffected: true });
    expect(json.$flagsState.plain.reason).toEqual({ kind: 'FALLTHROUGH' });
    expect(JSON.stringify(json.$flagsState.plain)).not.toContain('overrideAffected');
  });
});

describe('ingest strips the reserved key', () => {
  it('TestData preconfigured flag and segment arriving with the marker are not marked', async () => {
    const td = new TestData();
    await td.usePreconfiguredSegment({
      key: 's',
      version: 1,
      included: ['userkey'],
      _sdk_override: true,
    });
    await td.usePreconfiguredFlag({
      key: 'f',
      version: 1,
      on: true,
      fallthrough: { variation: 0 },
      variations: [false, true],
      rules: [
        { id: 'r', variation: 1, clauses: [{ attribute: '', op: 'segmentMatch', values: ['s'] }] },
      ],
      _sdk_override: true,
    });
    const client = new LDClientImpl(
      'sdk-key-proof-td',
      createBasicPlatform(),
      { updateProcessor: td.getFactory(), sendEvents: false },
      makeCallbacks(false),
    );
    await client.waitForInitialization({ timeout: 10 });
    const d = await client.variationDetail('f', user, false);
    expect(d.value).toBe(true);
    expect(d.reason).toEqual({ kind: 'RULE_MATCH', ruleId: 'r', ruleIndex: 0 });
    client.close();
  });

  it('FDv1 put, patch, and persistent store reads drop the root marker only', () => {
    const f = { key: 'f', version: 1, variations: [{ _sdk_override: true }], _sdk_override: true };
    const s = { key: 's', version: 1, _sdk_override: true };
    const all = deserializeAll(JSON.stringify({ data: { flags: { f }, segments: { s } } }))!;
    expect(all.data.flags.f).not.toHaveProperty('_sdk_override');
    expect(all.data.flags.f.variations).toEqual([{ _sdk_override: true }]);
    expect(all.data.segments.s).not.toHaveProperty('_sdk_override');
    const pf = deserializePatch(JSON.stringify({ path: '/flags/f', data: f }))!;
    const ps = deserializePatch(JSON.stringify({ path: '/segments/s', data: s }))!;
    expect(pf.data).not.toHaveProperty('_sdk_override');
    expect(ps.data).not.toHaveProperty('_sdk_override');
    const df = persistentStoreKinds.features.deserialize(JSON.stringify(f))!.item as any;
    const ds = persistentStoreKinds.segments.deserialize(JSON.stringify(s))!.item as any;
    expect(df).not.toHaveProperty('_sdk_override');
    expect(ds).not.toHaveProperty('_sdk_override');
  });
});

describe('serializer', () => {
  it('drops a root marker of any value, keeps nested ones, and does not mutate the flag', () => {
    const flag: any = {
      key: 'f',
      version: 1,
      variations: [{ _sdk_override: true }],
      rules: [{ id: 'r', clauses: [{ attribute: 'a', op: 'in', values: [{ _sdk_override: 1 }] }] }],
      _sdk_override: true,
    };
    const before = JSON.stringify(flag);
    const out = JSON.parse(serializeFlag(flag));
    expect(out).not.toHaveProperty('_sdk_override');
    expect(out.variations).toEqual([{ _sdk_override: true }]);
    expect(out.rules[0].clauses[0].values).toEqual([{ _sdk_override: 1 }]);
    expect(JSON.stringify(flag)).toEqual(before);
    expect(flag._sdk_override).toBe(true);
    expect(JSON.parse(serializeFlag({ ...flag, _sdk_override: false }))).not.toHaveProperty(
      '_sdk_override',
    );
  });

  it('a marked segment with generated target sets serializes arrays without the marker', () => {
    const included = Array.from({ length: 150 }, (_, i) => `u${i}`);
    const seg: any = { key: 's', version: 1, included };
    processSegment(seg);
    seg._sdk_override = true;
    expect(seg.generated_includedSet).toBeInstanceOf(Set);
    const out = JSON.parse(serializeSegment(seg));
    expect(out).not.toHaveProperty('_sdk_override');
    expect(out).not.toHaveProperty('generated_includedSet');
    expect(out.included).toEqual(included);
    expect(seg._sdk_override).toBe(true);
    expect(seg.generated_includedSet).toBeInstanceOf(Set);
    expect(seg.included).toBeUndefined();
  });

  it('a persistent store round trip of a marked flag is not marked', () => {
    const flag: any = { key: 'f', version: 3, on: true, variations: [1], _sdk_override: true };
    const ser = persistentStoreKinds.features.serialize(flag);
    expect(ser.serializedItem).not.toContain('_sdk_override');
    const back = persistentStoreKinds.features.deserialize(ser.serializedItem!)!.item as any;
    expect(back).not.toHaveProperty('_sdk_override');
  });
});
