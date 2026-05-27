import HeaderWrapper from '../../src/platform/HeaderWrapper';

it('returns the header value when present', () => {
  const wrapper = new HeaderWrapper({ 'content-type': 'application/json' });
  expect(wrapper.get('content-type')).toBe('application/json');
});

it('returns null when the header is absent', () => {
  const wrapper = new HeaderWrapper({});
  expect(wrapper.get('missing')).toBeNull();
});

it('joins array-valued headers with a comma separator', () => {
  const wrapper = new HeaderWrapper({ 'set-cookie': ['a=1', 'b=2'] });
  expect(wrapper.get('set-cookie')).toBe('a=1, b=2');
});

it('returns null when a header is explicitly undefined', () => {
  const wrapper = new HeaderWrapper({ 'x-empty': undefined });
  expect(wrapper.get('x-empty')).toBeNull();
});

it('iterates keys, values, and entries', () => {
  const wrapper = new HeaderWrapper({
    'content-type': 'application/json',
    'set-cookie': ['a=1', 'b=2'],
  });

  expect(Array.from(wrapper.keys()).sort()).toEqual(['content-type', 'set-cookie']);
  expect(Array.from(wrapper.values()).sort()).toEqual(['a=1, b=2', 'application/json']);
  expect(Array.from(wrapper.entries()).sort()).toEqual([
    ['content-type', 'application/json'],
    ['set-cookie', 'a=1, b=2'],
  ]);
});

it('skips undefined headers when iterating values and entries', () => {
  const wrapper = new HeaderWrapper({
    'content-type': 'application/json',
    'x-empty': undefined,
  });

  expect(Array.from(wrapper.values())).toEqual(['application/json']);
  expect(Array.from(wrapper.entries())).toEqual([['content-type', 'application/json']]);
});

it('reports presence with has()', () => {
  const wrapper = new HeaderWrapper({ 'content-type': 'application/json' });
  expect(wrapper.has('content-type')).toBe(true);
  expect(wrapper.has('missing')).toBe(false);
});
