import { StandardResolutionReasons } from '@openfeature/server-sdk';

import { translateResult } from '../src/translateResult';

it.each([true, 'potato', 42, { yes: 'no' }])('puts the value into the result.', (value) => {
  expect(
    translateResult<typeof value>({
      value,
      reason: {
        kind: 'OFF',
      },
    }).value,
  ).toEqual(value);
});

it('converts the variationIndex into a string variant', () => {
  expect(
    translateResult<boolean>({
      value: true,
      variationIndex: 9,
      reason: {
        kind: 'OFF',
      },
    }).variant,
  ).toEqual('9');
});

it.each([
  ['OFF', StandardResolutionReasons.DISABLED],
  ['FALLTHROUGH', 'FALLTHROUGH'],
  ['TARGET_MATCH', StandardResolutionReasons.TARGETING_MATCH],
  ['PREREQUISITE_FAILED', 'PREREQUISITE_FAILED'],
  ['ERROR', StandardResolutionReasons.ERROR],
])('populates the resolution reason', (reason, expectedReason) => {
    expect(
      translateResult<boolean>({
        value: true,
        variationIndex: 9,
        reason: {
          kind: reason,
        },
      }).reason,
    ).toEqual(expectedReason);
});

it('does not populate the errorCode when there is not an error', () => {
  const translated = translateResult<boolean>({
    value: true,
    variationIndex: 9,
    reason: {
      kind: 'OFF',
    },
  });
  expect(translated.errorCode).toBeUndefined();
});

it('does populate the errorCode when there is an error', () => {
  const translated = translateResult<boolean>({
    value: true,
    variationIndex: 9,
    reason: {
      kind: 'ERROR',
      errorKind: 'BAD_APPLE',
    },
  });
  expect(translated.errorCode).toEqual('GENERAL');
});

it('includes the variation index in the flag metadata', () => {
  expect(
    translateResult<boolean>({
      value: true,
      variationIndex: 9,
      reason: { kind: 'FALLTHROUGH' },
    }).flagMetadata,
  ).toEqual({ variationIndex: 9 });
});

it('omits the variation index from the flag metadata when there is no variation', () => {
  expect(
    translateResult<boolean>({
      value: true,
      variationIndex: null,
      reason: { kind: 'ERROR', errorKind: 'FLAG_NOT_FOUND' },
    }).flagMetadata,
  ).toEqual({});
});

it('includes inExperiment in the flag metadata for experiment evaluations', () => {
  expect(
    translateResult<boolean>({
      value: true,
      variationIndex: 9,
      reason: { kind: 'FALLTHROUGH', inExperiment: true },
    }).flagMetadata,
  ).toEqual({ variationIndex: 9, inExperiment: true });
});

it('omits inExperiment from the flag metadata for non-experiment evaluations', () => {
  expect(
    translateResult<boolean>({
      value: true,
      variationIndex: 9,
      reason: { kind: 'FALLTHROUGH', inExperiment: false },
    }).flagMetadata,
  ).toEqual({ variationIndex: 9 });
});

it('includes the rule in the flag metadata for rule matches', () => {
  expect(
    translateResult<boolean>({
      value: true,
      variationIndex: 9,
      reason: { kind: 'RULE_MATCH', ruleIndex: 2, ruleId: 'the-rule-id' },
    }).flagMetadata,
  ).toEqual({ variationIndex: 9, ruleIndex: 2, ruleId: 'the-rule-id' });
});

it('includes the prerequisite key in the flag metadata for failed prerequisites', () => {
  expect(
    translateResult<boolean>({
      value: true,
      variationIndex: 9,
      reason: { kind: 'PREREQUISITE_FAILED', prerequisiteKey: 'the-prerequisite-key' },
    }).flagMetadata,
  ).toEqual({ variationIndex: 9, prerequisiteKey: 'the-prerequisite-key' });
});

it('includes the big segments status in the flag metadata', () => {
  expect(
    translateResult<boolean>({
      value: true,
      variationIndex: 9,
      reason: { kind: 'FALLTHROUGH', bigSegmentsStatus: 'STALE' },
    }).flagMetadata,
  ).toEqual({ variationIndex: 9, bigSegmentsStatus: 'STALE' });
});
