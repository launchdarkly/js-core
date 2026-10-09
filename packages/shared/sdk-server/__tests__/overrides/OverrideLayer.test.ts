/* eslint-disable no-underscore-dangle */
import { AttributeReference } from '@launchdarkly/js-sdk-common';

import { makeFlagWithValue } from '../../src/data_sources/FileDataSource';
import { Flag } from '../../src/evaluation/data/Flag';
import { Segment } from '../../src/evaluation/data/Segment';
import TestData from '../../src/integrations/test_data/TestData';
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

describe('given definitions with the shape evaluation requires', () => {
  it('accepts full flag and segment definitions', () => {
    // Every list the data model has is present and filled, so each check sees a well-formed field.
    const flag = {
      ...rawFlag('flag1'),
      prerequisites: [{ key: 'other', variation: 0 }],
      contextTargets: [{ contextKind: 'org', variation: 1, values: ['org-a'] }],
      fallthrough: {
        rollout: {
          kind: 'experiment',
          bucketBy: 'name',
          contextKind: 'user',
          seed: 1,
          variations: [
            { variation: 0, weight: 50000 },
            { variation: 1, weight: 50000 },
          ],
        },
      },
      rules: [
        {
          id: 'rollout-rule',
          rollout: { bucketBy: 'name', variations: [{ variation: 1, weight: 100000 }] },
          clauses: [{ attribute: 'name', op: 'in', values: ['x'] }],
        },
        {
          id: 'segment-rule',
          variation: 0,
          clauses: [{ attribute: '', op: 'segmentMatch', values: ['segment1'] }],
        },
      ],
    };
    const segment = {
      ...rawSegment('segment1'),
      includedContexts: [{ contextKind: 'org', values: ['org-a'] }],
      excludedContexts: [{ contextKind: 'org', values: ['org-z'] }],
      rules: [
        {
          id: 'rule',
          weight: 50000,
          bucketBy: 'name',
          rolloutContextKind: 'user',
          clauses: [{ attribute: 'name', op: 'in', values: ['x'], contextKind: 'user' }],
        },
      ],
    };
    const layer = new OverrideLayer();

    layer.setAll([flag], [segment]);

    expect(layer.get(VersionedDataKinds.Features, 'flag1')).toBeDefined();
    expect(layer.get(VersionedDataKinds.Segments, 'segment1')).toBeDefined();
  });

  it('accepts absent optional lists, null fields, and rules without clauses', () => {
    // Only a flag's variations and the values of a target or clause are required. Every other
    // field may be absent, as it may be in LaunchDarkly data, and the preparation removes null
    // fields, so null counts as absent. A rule without clauses evaluates as no match.
    const flag = {
      key: 'flag1',
      version: 1,
      on: true,
      variations: [false, true],
      targets: null,
      contextTargets: null,
      prerequisites: null,
      fallthrough: null,
      rules: [
        { id: 'no-clauses', variation: 1 },
        { id: 'null-clauses', clauses: null },
      ],
    };
    const segment = {
      key: 'segment1',
      version: 1,
      included: null,
      includedContexts: null,
      rules: [{ id: 'no-clauses' }],
    };
    const layer = new OverrideLayer();

    layer.setAll([flag], [segment]);

    expect(layer.get(VersionedDataKinds.Features, 'flag1')).toBeDefined();
    expect(layer.get(VersionedDataKinds.Segments, 'segment1')).toBeDefined();
  });

  it('accepts the flag that the file data source expands from a value', () => {
    const layer = new OverrideLayer();

    layer.setAll([makeFlagWithValue('flag1', 'value', 1)], []);

    expect(layer.get(VersionedDataKinds.Features, 'flag1')).toBeDefined();
  });

  it('accepts the flags that the TestData builders build', () => {
    const flag = new TestData()
      .flag('flag1')
      .variationForContext('org', 'org-a', true)
      .variationForContext('user', 'user-a', false)
      .ifMatch('user', 'name', 'x')
      .thenReturn(true)
      .build(1);
    const layer = new OverrideLayer();

    layer.setAll([flag], []);

    expect(layer.get(VersionedDataKinds.Features, 'flag1')).toBeDefined();
  });
});

describe('given a definition that does not have the shape evaluation requires', () => {
  // Evaluation reads these fields with the types the data model declares and throws when a
  // hand-written definition has another type, so the layer rejects the definition first. The
  // error names the kind, the key, and the field, so an operator can find the mistake.
  function flagWith(changes: Record<string, any>): any {
    return { ...rawFlag('flag1'), ...changes };
  }

  function flagWithRule(rule: Record<string, any>): any {
    return flagWith({ rules: [{ id: 'rule', variation: 1, ...rule }] });
  }

  function segmentWith(changes: Record<string, any>): any {
    return { ...rawSegment('segment1'), ...changes };
  }

  function segmentWithRule(rule: Record<string, any>): any {
    return segmentWith({ rules: [{ id: 'rule', ...rule }] });
  }

  const malformedFlags: [string, any, string][] = [
    [
      'a flag without variations',
      flagWith({ variations: undefined }),
      '"variations" must be an array',
    ],
    [
      'variations that are not an array',
      flagWith({ variations: 'true' }),
      '"variations" must be an array',
    ],
    ['rules that are not an array', flagWith({ rules: {} }), '"rules" must be an array'],
    ['a rule that is not an object', flagWith({ rules: [null] }), 'rule 0 must be an object'],
    [
      'clauses that are not an array',
      flagWithRule({ clauses: 'name in x' }),
      'rule 0: "clauses" must be an array',
    ],
    [
      'a clause without values',
      flagWithRule({ clauses: [{ attribute: 'name', op: 'in' }] }),
      'rule 0, clause 0: "values" must be an array',
    ],
    [
      'a clause whose attribute is not a string',
      flagWithRule({ clauses: [{ attribute: 5, op: 'in', values: ['x'] }] }),
      'rule 0, clause 0: "attribute" must be a string',
    ],
    [
      'a target without values',
      flagWith({ targets: [{ variation: 1 }] }),
      'target 0: "values" must be an array',
    ],
    [
      'a context target without values',
      flagWith({ contextTargets: [{ contextKind: 'org', variation: 1 }] }),
      'context target 0: "values" must be an array',
    ],
    [
      'prerequisites that are not an array',
      flagWith({ prerequisites: { key: 'other', variation: 0 } }),
      '"prerequisites" must be an array',
    ],
    [
      'a prerequisite that is not an object',
      flagWith({ prerequisites: ['other'] }),
      'prerequisite 0 must be an object',
    ],
    [
      'a fallthrough that is not an object',
      flagWith({ fallthrough: 0 }),
      '"fallthrough" must be an object',
    ],
    [
      'a fallthrough rollout whose variations are not an array',
      flagWith({ fallthrough: { rollout: { variations: { variation: 0, weight: 100000 } } } }),
      'fallthrough, rollout: "variations" must be an array',
    ],
    [
      'a fallthrough rollout whose bucketBy is not a string',
      flagWith({
        fallthrough: { rollout: { bucketBy: 5, variations: [{ variation: 0, weight: 100000 }] } },
      }),
      'fallthrough, rollout: "bucketBy" must be a string',
    ],
    [
      'a rule rollout with a weighted variation that is not an object',
      flagWithRule({ variation: undefined, rollout: { variations: [null] } }),
      'rule 0, rollout: variation 0 must be an object',
    ],
  ];

  it.each(malformedFlags)('rejects %s', (_description, flag, message) => {
    const layer = new OverrideLayer();

    expect(() => layer.setAll([flag], [])).toThrow(`flag "flag1": ${message}`);
    expect(layer.isEmpty()).toBe(true);
  });

  const malformedSegments: [string, any, string][] = [
    [
      'an included list that is not an array',
      segmentWith({ included: 'user-a' }),
      '"included" must be an array',
    ],
    [
      'an excluded list that is not an array',
      segmentWith({ excluded: {} }),
      '"excluded" must be an array',
    ],
    [
      'an included context target without values',
      segmentWith({ includedContexts: [{ contextKind: 'org' }] }),
      'included context 0: "values" must be an array',
    ],
    [
      'an excluded context target whose values are not an array',
      segmentWith({ excludedContexts: [{ contextKind: 'org', values: 'org-a' }] }),
      'excluded context 0: "values" must be an array',
    ],
    ['rules that are not an array', segmentWith({ rules: {} }), '"rules" must be an array'],
    [
      'clauses that are not an array',
      segmentWithRule({ clauses: {} }),
      'rule 0: "clauses" must be an array',
    ],
    [
      'a clause without values',
      segmentWithRule({ clauses: [{ attribute: 'name', op: 'in' }] }),
      'rule 0, clause 0: "values" must be an array',
    ],
    [
      'a rule whose bucketBy is not a string',
      segmentWithRule({ bucketBy: ['name'], clauses: [] }),
      'rule 0: "bucketBy" must be a string',
    ],
  ];

  it.each(malformedSegments)('rejects a segment with %s', (_description, segment, message) => {
    const layer = new OverrideLayer();

    expect(() => layer.setAll([], [segment])).toThrow(`segment "segment1": ${message}`);
    expect(layer.isEmpty()).toBe(true);
  });

  it('rejects the whole snapshot and keeps the previous layer', () => {
    const layer = new OverrideLayer();
    layer.setAll([rawFlag('flag1')], [rawSegment('segment1')]);

    // The valid entries of the snapshot come before and after the malformed one, and none of
    // them is applied: a snapshot is all or nothing.
    expect(() =>
      layer.setAll(
        [rawFlag('flag2'), flagWith({ key: 'bad-flag', variations: undefined }), rawFlag('flag3')],
        [rawSegment('segment2')],
      ),
    ).toThrow('flag "bad-flag": "variations" must be an array');

    expect(Object.keys(layer.all(VersionedDataKinds.Features))).toEqual(['flag1']);
    expect(Object.keys(layer.all(VersionedDataKinds.Segments))).toEqual(['segment1']);
    expect(layer.isEmpty()).toBe(false);
  });
});
