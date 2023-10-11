import { internal } from '@launchdarkly/js-sdk-common';

import { Flag } from '../../src/evaluation/data/Flag';
import { getOffVariation, getVariation } from '../../src/evaluation/variations';

const { ErrorKinds, EvalResult, Reasons } = internal;

const baseFlag = {
  key: 'feature0',
  version: 1,
  on: true,
  fallthrough: { variation: 1 },
  variations: ['zero', 'one', 'two'],
};

const givenReason = Reasons.TargetMatch;

describe.each<[Flag, any, EvalResult]>([
  [{ ...baseFlag }, 0, EvalResult.forSuccess('zero', givenReason, 0)],
  [{ ...baseFlag }, 1, EvalResult.forSuccess('one', givenReason, 1)],
  [{ ...baseFlag }, 2, EvalResult.forSuccess('two', givenReason, 2)],
  [
    { ...baseFlag },
    3,
    EvalResult.forError(ErrorKinds.MalformedFlag, 'Invalid variation index in flag'),
  ],
  [
    { ...baseFlag },
    'potato',
    EvalResult.forError(ErrorKinds.MalformedFlag, 'Invalid variation index in flag'),
  ],
  [
    { ...baseFlag },
    undefined,
    EvalResult.forError(ErrorKinds.MalformedFlag, 'Invalid variation index in flag'),
  ],
])('given flag configurations with variations', (flag, index, expected) => {
  it(`produces the expected evaluation result for variations: ${flag.variations} variation index: ${index}`, () => {
    const result = getVariation(flag, index as number, givenReason);
    expect(result.isError).toEqual(expected.isError);
    expect(result.detail).toStrictEqual(expected.detail);
    expect(result.message).toEqual(expected.message);
  });
});

describe.each<[Flag, EvalResult]>([
  [{ ...baseFlag, offVariation: 0 }, EvalResult.forSuccess('zero', Reasons.Off, 0)],
  [{ ...baseFlag, offVariation: 1 }, EvalResult.forSuccess('one', Reasons.Off, 1)],
  [{ ...baseFlag, offVariation: 2 }, EvalResult.forSuccess('two', Reasons.Off, 2)],
  [{ ...baseFlag }, EvalResult.forSuccess(null, Reasons.Off, undefined)],
  [
    { ...baseFlag, offVariation: 3 },
    EvalResult.forError(ErrorKinds.MalformedFlag, 'Invalid variation index in flag'),
  ],
])('given flag configurations for accessing off variations', (flag, expected) => {
  it(`produces the expected evaluation result for flag off variation: ${flag.offVariation}`, () => {
    const result = getOffVariation(flag, Reasons.Off);
    expect(result.isError).toEqual(expected.isError);
    expect(result.detail).toStrictEqual(expected.detail);
    expect(result.message).toEqual(expected.message);
  });
});
