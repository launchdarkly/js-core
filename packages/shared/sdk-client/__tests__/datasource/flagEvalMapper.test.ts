import type { internal } from '@launchdarkly/js-sdk-common';

import {
  flagEvalPayloadToItemDescriptors,
  flagEvalUpdateToItemDescriptor,
  processFlagEval,
} from '../../src/datasource/flagEvalMapper';
import { FlagEvaluationResult } from '../../src/types';

const fullEvalResult: FlagEvaluationResult = {
  flagVersion: 42,
  value: 'green',
  variation: 1,
  prerequisites: ['flag-a', 'flag-b'],
  samplingRatio: 2,
  trackEvents: true,
  trackReason: true,
  reason: { kind: 'RULE_MATCH', ruleIndex: 0, ruleId: 'rule-1' },
  debugEventsUntilDate: 1700000000000,
};

const minimalEvalResult: FlagEvaluationResult = {
  value: false,
  trackEvents: false,
};

it('returns the object as-is from processFlagEval (passthrough)', () => {
  const input = { value: true, trackEvents: false };
  const result = processFlagEval(input);
  expect(result).toBe(input);
});

it('preserves all fields through processFlagEval', () => {
  const result = processFlagEval(fullEvalResult);
  expect(result).toEqual(fullEvalResult);
});

it('passes through objects with extra unrecognized fields in processFlagEval', () => {
  const input = { value: 'on', trackEvents: true, unknownField: 'hello', nested: { a: 1 } };
  const result = processFlagEval(input);
  expect(result).toBe(input);
});

it('converts a put update with all fields into an ItemDescriptor', () => {
  const update: internal.Update = {
    kind: 'flag_eval',
    key: 'my-flag',
    version: 5,
    object: fullEvalResult,
  };

  const descriptor = flagEvalUpdateToItemDescriptor(update);

  expect(descriptor.version).toBe(5);
  expect(descriptor.flag.version).toBe(5);
  expect(descriptor.flag.flagVersion).toBe(42);
  expect(descriptor.flag.value).toBe('green');
  expect(descriptor.flag.variation).toBe(1);
  expect(descriptor.flag.trackEvents).toBe(true);
  expect(descriptor.flag.trackReason).toBe(true);
  expect(descriptor.flag.reason).toEqual({ kind: 'RULE_MATCH', ruleIndex: 0, ruleId: 'rule-1' });
  expect(descriptor.flag.debugEventsUntilDate).toBe(1700000000000);
  expect(descriptor.flag.prerequisites).toEqual(['flag-a', 'flag-b']);
});

it('converts a put update with only required fields', () => {
  const update: internal.Update = {
    kind: 'flag_eval',
    key: 'minimal-flag',
    version: 1,
    object: minimalEvalResult,
  };

  const descriptor = flagEvalUpdateToItemDescriptor(update);

  expect(descriptor.version).toBe(1);
  expect(descriptor.flag.version).toBe(1);
  expect(descriptor.flag.value).toBe(false);
  expect(descriptor.flag.trackEvents).toBe(false);
  expect(descriptor.flag.flagVersion).toBeUndefined();
  expect(descriptor.flag.variation).toBeUndefined();
  expect(descriptor.flag.trackReason).toBeUndefined();
  expect(descriptor.flag.reason).toBeUndefined();
  expect(descriptor.flag.debugEventsUntilDate).toBeUndefined();
  expect(descriptor.flag.prerequisites).toBeUndefined();
});

it('converts a delete update into a tombstone descriptor', () => {
  const update: internal.Update = {
    kind: 'flag_eval',
    key: 'deleted-flag',
    version: 10,
    deleted: true,
  };

  const descriptor = flagEvalUpdateToItemDescriptor(update);

  expect(descriptor.version).toBe(10);
  expect(descriptor.flag.version).toBe(10);
  expect(descriptor.flag.deleted).toBe(true);
  expect(descriptor.flag.value).toBeUndefined();
  expect(descriptor.flag.trackEvents).toBe(false);
});

it('uses the envelope version as both ItemDescriptor.version and Flag.version', () => {
  const update: internal.Update = {
    kind: 'flag_eval',
    key: 'versioned-flag',
    version: 99,
    object: { ...minimalEvalResult, flagVersion: 7 },
  };

  const descriptor = flagEvalUpdateToItemDescriptor(update);

  expect(descriptor.version).toBe(99);
  expect(descriptor.flag.version).toBe(99);
  expect(descriptor.flag.flagVersion).toBe(7);
});

it('handles null value in evaluation result', () => {
  const update: internal.Update = {
    kind: 'flag_eval',
    key: 'null-flag',
    version: 1,
    object: { value: null, trackEvents: false },
  };

  const descriptor = flagEvalUpdateToItemDescriptor(update);

  expect(descriptor.flag.value).toBeNull();
});

it('handles complex object values', () => {
  const complexValue = { nested: { deeply: { value: [1, 2, 3] } } };
  const update: internal.Update = {
    kind: 'flag_eval',
    key: 'complex-flag',
    version: 3,
    object: { value: complexValue, trackEvents: true },
  };

  const descriptor = flagEvalUpdateToItemDescriptor(update);

  expect(descriptor.flag.value).toEqual(complexValue);
});

it('converts multiple flag_eval updates into a map of ItemDescriptors', () => {
  const updates: internal.Update[] = [
    {
      kind: 'flag_eval',
      key: 'flag-1',
      version: 1,
      object: { value: true, trackEvents: false },
    },
    {
      kind: 'flag_eval',
      key: 'flag-2',
      version: 2,
      object: { value: 'blue', trackEvents: true, variation: 0 },
    },
  ];

  const result = flagEvalPayloadToItemDescriptors(updates);

  expect(Object.keys(result)).toHaveLength(2);
  expect(result['flag-1'].flag.value).toBe(true);
  expect(result['flag-2'].flag.value).toBe('blue');
  expect(result['flag-2'].flag.variation).toBe(0);
});

it('silently ignores updates with unrecognized kinds', () => {
  const updates: internal.Update[] = [
    {
      kind: 'flag_eval',
      key: 'known-flag',
      version: 1,
      object: { value: true, trackEvents: false },
    },
    {
      kind: 'unknown_kind',
      key: 'mystery',
      version: 1,
      object: { something: 'weird' },
    },
    {
      kind: 'flag',
      key: 'server-flag',
      version: 1,
      object: { on: true },
    },
  ];

  const result = flagEvalPayloadToItemDescriptors(updates);

  expect(Object.keys(result)).toHaveLength(1);
  expect(result['known-flag']).toBeDefined();
  expect(result.mystery).toBeUndefined();
  expect(result['server-flag']).toBeUndefined();
});

it('returns an empty map for an empty updates array', () => {
  const result = flagEvalPayloadToItemDescriptors([]);
  expect(Object.keys(result)).toHaveLength(0);
});

it('handles a mix of puts and deletes', () => {
  const updates: internal.Update[] = [
    {
      kind: 'flag_eval',
      key: 'active-flag',
      version: 5,
      object: { value: 'red', trackEvents: true },
    },
    {
      kind: 'flag_eval',
      key: 'removed-flag',
      version: 3,
      deleted: true,
    },
  ];

  const result = flagEvalPayloadToItemDescriptors(updates);

  expect(Object.keys(result)).toHaveLength(2);
  expect(result['active-flag'].flag.value).toBe('red');
  expect(result['active-flag'].flag.deleted).toBeUndefined();
  expect(result['removed-flag'].flag.deleted).toBe(true);
  expect(result['removed-flag'].flag.value).toBeUndefined();
});

it('uses the last update when a key appears multiple times', () => {
  const updates: internal.Update[] = [
    {
      kind: 'flag_eval',
      key: 'dup-flag',
      version: 1,
      object: { value: 'first', trackEvents: false },
    },
    {
      kind: 'flag_eval',
      key: 'dup-flag',
      version: 2,
      object: { value: 'second', trackEvents: true },
    },
  ];

  const result = flagEvalPayloadToItemDescriptors(updates);

  expect(Object.keys(result)).toHaveLength(1);
  expect(result['dup-flag'].version).toBe(2);
  expect(result['dup-flag'].flag.value).toBe('second');
});
