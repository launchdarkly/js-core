/* eslint-disable no-underscore-dangle */
import { AttributeReference } from '@launchdarkly/js-sdk-common';

import { Flag } from '../../src/evaluation/data/Flag';
import { Segment } from '../../src/evaluation/data/Segment';
import { OverrideLayer } from '../../src/overrides';
import VersionedDataKinds from '../../src/store/VersionedDataKinds';

function rawFlag(key: string, version: number = 1): any {
  return {
    key,
    version,
    on: true,
    fallthrough: { variation: 0 },
    variations: [false, true],
    targets: [{ variation: 1, values: ['user-a', 'user-b'] }],
    rules: [
      {
        id: 'rule',
        variation: 1,
        clauses: [{ attribute: 'name', op: 'in', values: ['x', 'y'], negate: false }],
      },
    ],
  };
}

function rawSegment(key: string, version: number = 1): any {
  return {
    key,
    version,
    included: ['user-a'],
    excluded: ['user-z'],
    rules: [{ id: 'rule', clauses: [{ attribute: 'name', op: 'in', values: ['x', 'y'] }] }],
  };
}

it('stores marked copies and does not modify the supplied definitions', () => {
  const layer = new OverrideLayer();
  const flag = rawFlag('flag1', 2);
  const segment = rawSegment('segment1', 3);
  const pristineFlag = JSON.parse(JSON.stringify(flag));
  const pristineSegment = JSON.parse(JSON.stringify(segment));

  layer.setAll([flag], [segment]);

  expect(flag).toEqual(pristineFlag);
  expect(segment).toEqual(pristineSegment);
  expect(flag).not.toHaveProperty('_sdk_override');
  expect(flag.rules[0].clauses[0]).not.toHaveProperty('attributeReference');

  const storedFlag = layer.get(VersionedDataKinds.Features, 'flag1') as Flag;
  expect(storedFlag._sdk_override).toBe(true);
  expect(storedFlag.version).toEqual(2);
  expect(storedFlag).not.toBe(flag);

  const storedSegment = layer.get(VersionedDataKinds.Segments, 'segment1') as Segment;
  expect(storedSegment._sdk_override).toBe(true);
  expect(storedSegment.version).toEqual(3);
  expect(storedSegment).not.toBe(segment);
});

it('prepares the copies for evaluation like data from LaunchDarkly', () => {
  const layer = new OverrideLayer();
  layer.setAll([rawFlag('flag1')], [rawSegment('segment1')]);

  const storedFlag = layer.get(VersionedDataKinds.Features, 'flag1') as Flag;
  const flagClause = storedFlag.rules![0].clauses![0];
  expect(flagClause.attributeReference).toBeInstanceOf(AttributeReference);
  expect(flagClause.attributeReference.isValid).toBe(true);

  const storedSegment = layer.get(VersionedDataKinds.Segments, 'segment1') as Segment;
  const segmentClause = storedSegment.rules![0].clauses[0];
  expect(segmentClause.attributeReference).toBeInstanceOf(AttributeReference);
});

it('replaces the whole layer with each snapshot', () => {
  const layer = new OverrideLayer();
  expect(layer.isEmpty()).toBe(true);
  expect(layer.get(VersionedDataKinds.Features, 'flag1')).toBeUndefined();

  layer.setAll([rawFlag('flag1')], []);
  expect(layer.isEmpty()).toBe(false);
  expect(layer.get(VersionedDataKinds.Features, 'flag1')).toBeDefined();

  // A replacement is a full snapshot. Entries absent from it are removed.
  layer.setAll([rawFlag('flag2')], []);
  expect(layer.get(VersionedDataKinds.Features, 'flag1')).toBeUndefined();
  expect(layer.get(VersionedDataKinds.Features, 'flag2')).toBeDefined();

  layer.setAll([], []);
  expect(layer.isEmpty()).toBe(true);
  expect(layer.get(VersionedDataKinds.Features, 'flag2')).toBeUndefined();
});

it('reports only segments as non-empty too', () => {
  const layer = new OverrideLayer();
  layer.setAll([], [rawSegment('segment1')]);
  expect(layer.isEmpty()).toBe(false);
  expect(layer.get(VersionedDataKinds.Segments, 'segment1')).toBeDefined();
  expect(layer.get(VersionedDataKinds.Features, 'segment1')).toBeUndefined();
});

it('returns all entries of a kind keyed by key', () => {
  const layer = new OverrideLayer();
  layer.setAll([rawFlag('flag1'), rawFlag('flag2')], [rawSegment('segment1')]);

  const flags = layer.all(VersionedDataKinds.Features);
  expect(Object.keys(flags).sort()).toEqual(['flag1', 'flag2']);
  expect((flags.flag1 as Flag)._sdk_override).toBe(true);
  expect(Object.keys(layer.all(VersionedDataKinds.Segments))).toEqual(['segment1']);
  expect(new OverrideLayer().all(VersionedDataKinds.Features)).toEqual({});
});

it('returns the previous and the new contents with the supplied text of each entry', () => {
  const layer = new OverrideLayer();
  const first = layer.setAll([rawFlag('flag1', 1)], []);
  expect(first.previous.features).toEqual({});
  expect(first.current.features.flag1.json).toEqual(JSON.stringify(rawFlag('flag1', 1)));

  const second = layer.setAll([rawFlag('flag1', 2)], [rawSegment('segment1')]);
  expect(second.previous).toBe(first.current);
  expect(second.current.features.flag1.json).toEqual(JSON.stringify(rawFlag('flag1', 2)));
  expect(second.current.segments.segment1.item.key).toEqual('segment1');
});
