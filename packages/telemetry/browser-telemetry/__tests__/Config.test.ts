import parse, { defaultOptions } from '../src/options';

it('handles an empty configuration', () => {
  const outOptions = parse({});
  expect(outOptions).toEqual(defaultOptions)
});
