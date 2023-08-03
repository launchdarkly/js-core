import { Flag } from '../../src/evaluation/data/Flag';
import { Segment } from '../../src/evaluation/data/Segment';
import {
  deserializeAll,
  deserializeDelete,
  deserializePatch,
  replacer,
  reviver,
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

function makeAllData(flag?: any, segment?: any, override?: any, metric?: any): any {
  const allData: any = {
    data: {
      flags: {},
      segments: {},
      configurationOverrides: {},
      metrics: {},
    },
  };

  if (flag) {
    allData.data.flags.flagName = flag;
  }
  if (segment) {
    allData.data.segments.segmentName = segment;
  }
  if (override) {
    allData.data.configurationOverrides.overrideName = override;
  }
  if (metric) {
    allData.data.metrics.metricName = metric;
  }
  return allData;
}

function makeSerializedAllData(flag?: any, segment?: any, override?: any, metric?: any): string {
  return JSON.stringify(makeAllData(flag, segment, override, metric));
}

function makePatchData(flag?: any, segment?: any, override?: any, metric?: any): any {
  let path = '/flags/flagName';
  if (segment) {
    path = '/segments/segmentName';
  }
  if (override) {
    path = '/configurationOverrides/overrideName';
  }
  if (metric) {
    path = '/metrics/metricName';
  }
  return {
    path,
    data: flag ?? segment ?? override ?? metric,
  };
}

function makeSerializedPatchData(flag?: any, segment?: any, override?: any, metric?: any): string {
  return JSON.stringify(makePatchData(flag, segment, override, metric));
}

describe('when deserializing all data', () => {
  it('handles a flag with an attribute literal in a clause', () => {
    const jsonString = makeSerializedAllData(flagWithAttributeNameInClause);
    const parsed = deserializeAll(jsonString);
    const ref = parsed?.data.flags.flagName.rules?.[0].clauses?.[0].attributeReference;
    expect(ref?.isValid).toBeTruthy();
  });

  it('handles a flag with an attribute literal in a clause', () => {
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

  it('handles a config override', () => {
    const override = {
      key: 'overrideName',
      value: 'potato',
      version: 1,
    };
    const jsonString = makeSerializedAllData(undefined, undefined, override, undefined);
    const parsed = deserializeAll(jsonString);
    expect(parsed).toMatchObject({ data: { configurationOverrides: { overrideName: override } } });
  });

  it('handles a metric', () => {
    const metric = {
      key: 'metricName',
      samplingRatio: 42,
      version: 1,
    };
    const jsonString = makeSerializedAllData(undefined, undefined, undefined, metric);
    const parsed = deserializeAll(jsonString);
    expect(parsed).toMatchObject({ data: { metrics: { metricName: metric } } });
  });
});

describe('when deserializing patch data', () => {
  it('handles a flag with an attribute literal in a clause', () => {
    const jsonString = makeSerializedPatchData(flagWithAttributeNameInClause);
    const parsed = deserializePatch(jsonString);
    const ref = (parsed?.data as Flag).rules?.[0].clauses?.[0].attributeReference;
    expect(ref?.isValid).toBeTruthy();
  });

  it('handles a flag with an attribute literal in a clause', () => {
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

  it('handles a config override', () => {
    const override = {
      key: 'overrideName',
      value: 'potato',
      version: 1,
    };
    const jsonString = makeSerializedPatchData(undefined, undefined, override, undefined);
    const parsed = deserializePatch(jsonString);
    expect(parsed).toEqual({
      data: override,
      path: '/configurationOverrides/overrideName',
      kind: {
        namespace: 'configurationOverrides',
        streamApiPath: '/configurationOverrides/',
      },
    });
  });

  it('handles a metric', () => {
    const metric = {
      key: 'metricName',
      samplingRatio: 42,
      version: 1,
    };
    const jsonString = makeSerializedPatchData(undefined, undefined, undefined, metric);
    const parsed = deserializePatch(jsonString);
    expect(parsed).toEqual({
      data: metric,
      path: '/metrics/metricName',
      kind: {
        namespace: 'metrics',
        streamApiPath: '/metrics/',
      },
    });
  });
});

it('removes null elements', () => {
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
  const parsed = JSON.parse(stringPolluted, reviver);
  expect(parsed).toStrictEqual(baseData);
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
