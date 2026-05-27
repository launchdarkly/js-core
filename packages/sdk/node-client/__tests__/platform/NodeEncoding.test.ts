import NodeEncoding from '../../src/platform/NodeEncoding';

it('can base64 a basic ASCII string', () => {
  const encoding = new NodeEncoding();
  expect(encoding.btoa('toaster')).toEqual('dG9hc3Rlcg==');
});

it('can base64 a unicode string containing multi-byte characters', () => {
  const encoding = new NodeEncoding();
  expect(encoding.btoa('✇⽊❽⾵⊚▴ⶊ↺➹≈⋟⚥⤅⊈ⲏⷨ⾭Ⲗ⑲▯ⶋₐℛ⬎⿌🦄')).toEqual(
    '4pyH4r2K4p294r614oqa4pa04raK4oa64p654omI4ouf4pql4qSF4oqI4rKP4reo4r6t4rKW4pGy4pav4raL4oKQ4oSb4qyO4r+M8J+mhA==',
  );
});

it('returns an empty string when input is empty', () => {
  const encoding = new NodeEncoding();
  expect(encoding.btoa('')).toEqual('');
});
