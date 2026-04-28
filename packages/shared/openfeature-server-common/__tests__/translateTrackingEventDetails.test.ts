import { translateTrackingEventDetails } from '../src/translateTrackingEventDetails';

it('returns undefined if details are empty', () => {
  expect(translateTrackingEventDetails({})).toBeUndefined();
});

it('returns undefined if details only contains value', () => {
  expect(translateTrackingEventDetails({ value: 12345 })).toBeUndefined();
});

it('returns an object without the value attribute', () => {
  expect(
    translateTrackingEventDetails({
      value: 12345,
      key1: 'val1',
      key2: 'val2',
    }),
  ).toEqual({
    key1: 'val1',
    key2: 'val2',
  });
});
