import { AttributeReference } from '@launchdarkly/js-sdk-common';

import { Flag } from '../../src/evaluation/data/Flag';
import { Segment } from '../../src/evaluation/data/Segment';
import {
  deserializeAll,
  deserializeDelete,
  deserializePatch,
  nullReplacer,
  replacer,
  serializeFlag,
  serializeSegment,
} from '../../src/store/serialization';

const flagWithAttributeNameInClause = {
  key: 'test-after-value1',
  on: true,
  rules: [
    {
      variation: 0,
      id: 'ruleid',
      clauses: [
        {
          attribute: 'attrname',
          op: 'after',
          values: ['not valid'],
          negate: false,
        },
      ],
      trackEvents: false,
    },
  ],
  fallthrough: { variation: 1 },
  variations: [true, false],
  version: 1,
};

const flagWithAttributeReferenceInClause = {
  key: 'test-flag',
  on: true,
  rules: [
    {
      variation: 0,
      id: 'ruleid',
      clauses: [
        {
          contextKind: 'user',
          attribute: '/attr1',
          op: 'in',
          values: ['right'],
          negate: false,
        },
      ],
      trackEvents: false,
    },
  ],
  fallthrough: { variation: 1 },
  variations: [true, false],
  version: 1,
};

const flagWithBucketByInRollout = {
  key: 'test-flag',
  on: true,
  fallthrough: {
    rollout: {
      bucketBy: 'bucket',
      variations: [{ variation: 0, weight: 5 }],
    },
  },
  variations: [true, false],
  version: 1,
};

const flagWithBucketByInRolloutInRule = {
  key: 'test-after-value1',
  on: true,
  rules: [
    {
      variation: 0,
      id: 'ruleid',
      clauses: [
        {
          attribute: 'attrname',
          op: 'after',
          values: ['not valid'],
          negate: false,
        },
      ],
      trackEvents: false,
      rollout: {
        bucketBy: 'bucket',
        variations: [{ variation: 0, weight: 5 }],
      },
    },
  ],
  fallthrough: { variation: 1 },
  variations: [true, false],
  version: 1,
};

const flagWithNoReferences = {
  key: 'test-flag',
  on: true,
  fallthrough: {
    rollout: {
      variations: [{ variation: 0, weight: 5 }],
    },
  },
  variations: [true, false],
  version: 1,
};

const segmentWithClauseAttributeName = {
  key: 'test-segment-1',
  included: [],
  excluded: [],
  includedContexts: [],
  excludedContexts: [],
  salt: 'saltyA',
  rules: [
    {
      id: '',
      clauses: [
        {
          attribute: 'kind',
          op: 'in',
          values: [''],
          negate: true,
        },
      ],
      weight: 42162,
      rolloutContextKind: 'user',
    },
  ],
  version: 0,
  deleted: false,
};

const segmentWithBucketBy = {
  key: 'test-segment-1',
  included: [],
  excluded: [],
  includedContexts: [],
  excludedContexts: [],
  salt: 'saltyA',
  rules: [
    {
      id: 'rule-id',
      clauses: [],
      bucketBy: 'potato',
    },
  ],
  version: 0,
  deleted: false,
};

const flagWithNullInJsonVariation = {
  key: 'flagName',
  on: true,
  fallthrough: { variation: 1 },
  variations: [[true, null, 'potato'], [null, null], { null: null }, { arr: [null] }],
  version: 1,
};

const flagWithManyNulls = {
  key: 'test-after-value1',
  on: true,
  rules: [
    {
      variation: 0,
      id: 'ruleid',
      clauses: [
        {
          attribute: 'attrname',
          op: 'after',
          values: ['not valid'],
          negate: null,
        },
      ],
      trackEvents: null,
    },
  ],
  offVariation: null,
  fallthrough: { variation: 1 },
  variations: [true, false],
  version: 1,
};

function makeAllData(flag?: any, segment?: any): any {
  const allData: any = {
    data: {
      flags: {},
      segments: {},
    },
  };

  if (flag) {
    allData.data.flags.flagName = flag;
  }
  if (segment) {
    allData.data.segments.segmentName = segment;
  }
  return allData;
}

function makeSerializedAllData(flag?: any, segment?: any): string {
  return JSON.stringify(makeAllData(flag, segment));
}

function makePatchData(flag?: any, segment?: any): any {
  let path = '/flags/flagName';
  if (segment) {
    path = '/segments/segmentName';
  }
  return {
    path,
    data: flag ?? segment,
  };
}

function makeSerializedPatchData(flag?: any, segment?: any): string {
  return JSON.stringify(makePatchData(flag, segment));
}

describe('when deserializing all data', () => {
  it('handles a flag with an attribute literal in a clause', () => {
    const jsonString = makeSerializedAllData(flagWithAttributeNameInClause);
    const parsed = deserializeAll(jsonString);
    const ref = parsed?.data.flags.flagName.rules?.[0].clauses?.[0].attributeReference;
    expect(ref?.isValid).toBeTruthy();
  });

  it('handles a flag with an attribute ref in a clause', () => {
    const jsonString = makeSerializedAllData(flagWithAttributeReferenceInClause);
    const parsed = deserializeAll(jsonString);
    const ref = parsed?.data.flags.flagName.rules?.[0].clauses?.[0].attributeReference;
    expect(ref?.isValid).toBeTruthy();
  });

  it('handles a flag with no references', () => {
    const jsonString = makeSerializedAllData(flagWithNoReferences);
    const parsed = deserializeAll(jsonString);
    const ref = parsed?.data.flags.flagName.rules?.[0].clauses?.[0].attributeReference;
    expect(ref).toBeUndefined();
  });

  it('handles a segment clause with attribute name', () => {
    const jsonString = makeSerializedAllData(undefined, segmentWithClauseAttributeName);
    const parsed = deserializeAll(jsonString);
    const refInSegment =
      parsed?.data.segments.segmentName.rules?.[0].clauses?.[0].attributeReference;
    expect(refInSegment?.isValid).toBeTruthy();
  });

  it('handles a segment with bucketBy', () => {
    const jsonString = makeSerializedAllData(undefined, segmentWithBucketBy);
    const parsed = deserializeAll(jsonString);
    const bucketByInSegment =
      parsed!.data.segments.segmentName.rules![0].bucketByAttributeReference;
    expect(bucketByInSegment?.isValid).toBeTruthy();
  });

  it('handles a flag with bucketBy in rollout', () => {
    const jsonString = makeSerializedAllData(flagWithBucketByInRollout);
    const parsed = deserializeAll(jsonString);
    const ref = parsed?.data.flags.flagName.fallthrough.rollout?.bucketByAttributeReference;
    expect(ref?.isValid).toBeTruthy();
  });

  it('handles a flag with a rollout in a rule', () => {
    const jsonString = makeSerializedAllData(flagWithBucketByInRolloutInRule);
    const parsed = deserializeAll(jsonString);
    const ref = parsed?.data.flags.flagName.rules?.[0].rollout?.bucketByAttributeReference;
    expect(ref?.isValid).toBeTruthy();
  });

  it('does not replace null in Objects or array JSON variations', () => {
    const jsonString = makeSerializedAllData(flagWithNullInJsonVariation);
    const parsed = deserializeAll(jsonString);

    expect(parsed?.data.flags.flagName.variations).toStrictEqual(
      flagWithNullInJsonVariation.variations,
    );
  });

  it('removes null values outside variations', () => {
    const jsonString = makeSerializedAllData(flagWithManyNulls);
    const parsed = deserializeAll(jsonString);

    expect(parsed?.data.flags.flagName).toStrictEqual({
      key: 'test-after-value1',
      on: true,
      rules: [
        {
          variation: 0,
          id: 'ruleid',
          clauses: [
            {
              attribute: 'attrname',
              attributeReference: new AttributeReference('attrname'),
              op: 'after',
              values: ['not valid'],
            },
          ],
        },
      ],
      fallthrough: { variation: 1 },
      variations: [true, false],
      version: 1,
    });
  });
});

describe('when deserializing patch data', () => {
  it('handles a flag with an attribute literal in a clause', () => {
    const jsonString = makeSerializedPatchData(flagWithAttributeNameInClause);
    const parsed = deserializePatch(jsonString);
    const ref = (parsed?.data as Flag).rules?.[0].clauses?.[0].attributeReference;
    expect(ref?.isValid).toBeTruthy();
  });

  it('handles a flag with an attribute ref in a clause', () => {
    const jsonString = makeSerializedPatchData(flagWithAttributeReferenceInClause);
    const parsed = deserializePatch(jsonString);
    const ref = (parsed?.data as Flag).rules?.[0].clauses?.[0].attributeReference;
    expect(ref?.isValid).toBeTruthy();
  });

  it('handles a flag with no references', () => {
    const jsonString = makeSerializedPatchData(flagWithNoReferences);
    const parsed = deserializePatch(jsonString);
    const ref = (parsed?.data as Flag).rules?.[0].clauses?.[0].attributeReference;
    expect(ref).toBeUndefined();
  });

  it('handles a segment clause with attribute name', () => {
    const jsonString = makeSerializedPatchData(undefined, segmentWithClauseAttributeName);
    const parsed = deserializePatch(jsonString);
    const refInSegment = (parsed?.data as Segment).rules?.[0].clauses?.[0].attributeReference;
    expect(refInSegment?.isValid).toBeTruthy();
  });

  it('handles a segment with bucketBy', () => {
    const jsonString = makeSerializedPatchData(undefined, segmentWithBucketBy);
    const parsed = deserializePatch(jsonString);
    const bucketByInSegment = (parsed!.data as Segment).rules![0].bucketByAttributeReference;
    expect(bucketByInSegment?.isValid).toBeTruthy();
  });

  it('handles a flag with bucketBy in rollout', () => {
    const jsonString = makeSerializedPatchData(flagWithBucketByInRollout);
    const parsed = deserializePatch(jsonString);
    const ref = (parsed?.data as Flag).fallthrough.rollout?.bucketByAttributeReference;
    expect(ref?.isValid).toBeTruthy();
  });

  it('handles a flag with a rollout in a rule', () => {
    const jsonString = makeSerializedPatchData(flagWithBucketByInRolloutInRule);
    const parsed = deserializePatch(jsonString);
    const ref = (parsed?.data as Flag).rules?.[0].rollout?.bucketByAttributeReference;
    expect(ref?.isValid).toBeTruthy();
  });

  it('does not replace null in Objects or array JSON variations', () => {
    const jsonString = makeSerializedPatchData(flagWithNullInJsonVariation);
    const parsed = deserializePatch(jsonString);

    expect((parsed?.data as Flag)?.variations).toStrictEqual(
      flagWithNullInJsonVariation.variations,
    );
  });

  it('removes null values outside variations', () => {
    const jsonString = makeSerializedPatchData(flagWithManyNulls);
    const parsed = deserializePatch(jsonString);

    expect(parsed?.data as Flag).toStrictEqual({
      key: 'test-after-value1',
      on: true,
      rules: [
        {
          variation: 0,
          id: 'ruleid',
          clauses: [
            {
              attribute: 'attrname',
              attributeReference: new AttributeReference('attrname'),
              op: 'after',
              values: ['not valid'],
            },
          ],
        },
      ],
      fallthrough: { variation: 1 },
      variations: [true, false],
      version: 1,
    });
  });
});

it('removes null elements that are not part of arrays', () => {
  const baseData = {
    a: 'b',
    b: 'c',
    c: {
      d: 'e',
    },
  };

  const polluted = JSON.parse(JSON.stringify(baseData));
  polluted.e = null;
  polluted.c.f = null;

  const stringPolluted = JSON.stringify(polluted);
  const parsed = JSON.parse(stringPolluted);
  nullReplacer(parsed);
  expect(parsed).toStrictEqual(baseData);
});

it('does not remove null in arrays', () => {
  const data = {
    a: ['b', null, { arr: [null] }],
    c: {
      d: ['e', null, { arr: [null] }],
    },
  };

  const parsed = JSON.parse(JSON.stringify(data));
  nullReplacer(parsed);
  expect(parsed).toStrictEqual(data);
});

it('does remove null from objects that are inside of arrays', () => {
  const data = {
    a: ['b', null, { null: null, notNull: true }],
    c: {
      d: ['e', null, { null: null, notNull: true }],
    },
  };

  const parsed = JSON.parse(JSON.stringify(data));
  nullReplacer(parsed);
  expect(parsed).toStrictEqual({
    a: ['b', null, { notNull: true }],
    c: {
      d: ['e', null, { notNull: true }],
    },
  });
});

it('can handle attempting to replace nulls for an undefined or null value', () => {
  expect(() => {
    nullReplacer(null);
    nullReplacer(undefined);
  }).not.toThrow();
});

it.each([
  [flagWithAttributeNameInClause, undefined],
  [flagWithAttributeReferenceInClause, undefined],
  [flagWithNoReferences, undefined],
  [flagWithBucketByInRollout, undefined],
  [flagWithBucketByInRolloutInRule, undefined],
  [undefined, segmentWithClauseAttributeName],
  [undefined, segmentWithBucketBy],
  [flagWithAttributeNameInClause, segmentWithClauseAttributeName],
])('serialization removes attribute refs', (flag, segment) => {
  const stringVersion = makeSerializedAllData(flag, segment);
  // Parsed will have attribute refs.
  const parsed = deserializeAll(stringVersion);
  // Should be removed in the string version.
  const reSerialized = JSON.stringify(parsed, replacer);
  // Deserialize without our deserializer.
  const plainParsed = JSON.parse(reSerialized);
  expect(plainParsed).toStrictEqual(makeAllData(flag, segment));
});

it('deserializes delete data', () => {
  const deleteVal = { path: '/flags/flagkey', version: 2 };
  const deleteString = JSON.stringify(deleteVal);
  const parsed = deserializeDelete(deleteString);
  delete parsed?.kind;
  expect(parsed).toStrictEqual(deleteVal);
});

it('given bad json', () => {
  const data = '{sorry';
  expect(deserializeAll(data)).toBeUndefined();
  expect(deserializePatch(data)).toBeUndefined();
  expect(deserializeDelete(data)).toBeUndefined();
});

it('deserialization creates a set for a large number of includes/excludes', () => {
  const included = [...Array(500).keys()].map((i) => (i + 1).toString());
  const excluded = [...Array(500).keys()].map((i) => (i + 10).toString());

  const jsonString = makeSerializedPatchData(undefined, {
    key: 'test-segment-1',
    included,
    excluded,
    includedContexts: [],
    excludedContexts: [],
    salt: 'saltyA',
    rules: [],
    version: 0,
    deleted: false,
  });

  const res = deserializePatch(jsonString);
  const segment = res?.data as Segment;
  expect(segment.included).toBeUndefined();
  expect(segment.excluded).toBeUndefined();

  expect([...segment.generated_includedSet!]).toEqual(included);
  expect([...segment.generated_excludedSet!]).toEqual(excluded);
});

it('deserialization creates a set for a large number of included/excluded context values', () => {
  const included = [...Array(500).keys()].map((i) => (i + 10).toString());
  const excluded = [...Array(500).keys()].map((i) => (i + 1).toString());

  const jsonString = makeSerializedPatchData(undefined, {
    key: 'test-segment-1',
    included: [],
    excluded: [],
    includedContexts: [{ contextKind: 'org', values: included }],
    excludedContexts: [{ contextKind: 'user', values: excluded }],
    salt: 'saltyA',
    rules: [],
    version: 0,
    deleted: false,
  });

  const res = deserializePatch(jsonString);
  const segment = res?.data as Segment;

  expect([...segment.includedContexts![0].generated_valuesSet!]).toEqual(included);
  expect([...segment.excludedContexts![0].generated_valuesSet!]).toEqual(excluded);
});

it('serialization converts sets back to arrays for included/excluded', () => {
  const included = [...Array(500).keys()].map((i) => (i + 1).toString());
  const excluded = [...Array(500).keys()].map((i) => (i + 10).toString());

  const jsonString = makeSerializedPatchData(undefined, {
    key: 'test-segment-1',
    included,
    excluded,
    includedContexts: [],
    excludedContexts: [],
    salt: 'saltyA',
    rules: [],
    version: 0,
    deleted: false,
  });

  const res = deserializePatch(jsonString);
  const segment = res?.data as Segment;

  const serializedSegment = serializeSegment(segment);
  // Just json parse. We don't want it to automatically re-populate the sets.
  const jsonDeserialized = JSON.parse(serializedSegment);

  expect(jsonDeserialized.included).toEqual(included);
  expect(jsonDeserialized.excluded).toEqual(excluded);
  expect(jsonDeserialized.generated_includedSet).toBeUndefined();
  expect(jsonDeserialized.generated_excludedSet).toBeUndefined();
});

it('serialization converts sets back to arrays for includedContexts/excludedContexts', () => {
  const included = [...Array(500).keys()].map((i) => (i + 1).toString());
  const excluded = [...Array(500).keys()].map((i) => (i + 10).toString());

  const jsonString = makeSerializedPatchData(undefined, {
    key: 'test-segment-1',
    included: [],
    excluded: [],
    includedContexts: [{ contextKind: 'org', values: included }],
    excludedContexts: [{ contextKind: 'user', values: excluded }],
    salt: 'saltyA',
    rules: [],
    version: 0,
    deleted: false,
  });

  const res = deserializePatch(jsonString);
  const segment = res?.data as Segment;

  const serializedSegment = serializeSegment(segment);
  // Just json parse. We don't want it to automatically re-populate the sets.
  const jsonDeserialized = JSON.parse(serializedSegment);

  expect(jsonDeserialized.includedContexts[0].values).toEqual(included);
  expect(jsonDeserialized.excludedContexts[0].values).toEqual(excluded);
  expect(jsonDeserialized.includedContexts[0].generated_valuesSet).toBeUndefined();
  expect(jsonDeserialized.excludedContexts[0].generated_valuesSet).toBeUndefined();
});

it('serializes null values without issue', () => {
  const jsonString = makeSerializedAllData(flagWithNullInJsonVariation);
  const parsed = deserializeAll(jsonString);
  const serialized = serializeFlag(parsed!.data.flags.flagName);
  // After serialization nulls should still be there, and any memo generated items should be gone.
  expect(JSON.parse(serialized)).toEqual(flagWithNullInJsonVariation);
});
