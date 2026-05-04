import * as ld from '../src';

it('exports a version string', () => {
  expect(typeof ld.version).toBe('string');
  expect(ld.version.length).toBeGreaterThan(0);
});
