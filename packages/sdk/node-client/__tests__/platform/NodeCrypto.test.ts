import NodeCrypto from '../../src/platform/NodeCrypto';

it('produces a sha256 digest matching the known fixture', () => {
  const crypto = new NodeCrypto();
  const hasher = crypto.createHash('sha256');
  hasher.update('the quick brown fox');
  expect(hasher.digest!('hex')).toBe(
    '9ecb36561341d18eb65484e833efea61edc74b84cf5e6ae1b81c63533e25fc8f',
  );
});

it('produces a deterministic hmac digest for the same key and message', () => {
  const crypto = new NodeCrypto();
  const hmacA = crypto.createHmac!('sha256', 'key');
  hmacA.update('message');
  const hmacB = crypto.createHmac!('sha256', 'key');
  hmacB.update('message');
  expect(hmacA.digest('hex')).toBe(hmacB.digest('hex'));
});

it('produces different hmac digests for different keys', () => {
  const crypto = new NodeCrypto();
  const hmacA = crypto.createHmac!('sha256', 'keyA');
  hmacA.update('message');
  const hmacB = crypto.createHmac!('sha256', 'keyB');
  hmacB.update('message');
  expect(hmacA.digest('hex')).not.toBe(hmacB.digest('hex'));
});

it('generates a UUID matching the v4 format', () => {
  const crypto = new NodeCrypto();
  expect(crypto.randomUUID()).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

it('generates distinct UUIDs across calls', () => {
  const crypto = new NodeCrypto();
  expect(crypto.randomUUID()).not.toBe(crypto.randomUUID());
});
