import {
  assertNamespaceAvailable,
  claimNamespace,
  deriveNamespace,
  getIPCChannelName,
  releaseNamespace,
} from '../src/ElectronIPC';

afterEach(() => {
  releaseNamespace('ns-claimed');
  releaseNamespace('ns-twice');
  releaseNamespace('ns-released');
  releaseNamespace('ns-asserted');
});

it('derives namespace from credential alone', () => {
  expect(deriveNamespace('mob-abc-123')).toBe('mob-abc-123');
});

it('derives namespace from credential with custom namespace', () => {
  expect(deriveNamespace('mob-abc-123', 'my-namespace')).toBe('my-namespace_mob-abc-123');
});

it('produces different namespaces with and without custom namespace', () => {
  const credential = 'mob-abc-123';
  expect(deriveNamespace(credential)).not.toBe(deriveNamespace(credential, 'ns'));
});

it('produces different namespaces for different custom namespaces', () => {
  const credential = 'mob-abc-123';
  expect(deriveNamespace(credential, 'ns-a')).not.toBe(deriveNamespace(credential, 'ns-b'));
});

it('undefined namespace equals no namespace', () => {
  const credential = 'mob-abc-123';
  expect(deriveNamespace(credential, undefined)).toBe(deriveNamespace(credential));
});

it('builds IPC channel names', () => {
  expect(getIPCChannelName('ns', 'allFlags')).toBe('ld:ns:allFlags');
});

it('claims a namespace that is not in use', () => {
  expect(() => claimNamespace('ns-claimed')).not.toThrow();
});

it('throws when a namespace is claimed twice', () => {
  claimNamespace('ns-twice');

  expect(() => claimNamespace('ns-twice')).toThrow(
    'IPC namespace "ns-twice" is already in use by another LaunchDarkly client. Close that client first, or give each client that shares a credential a unique "namespace" option.',
  );
});

it('assertNamespaceAvailable throws for a claimed namespace without claiming it', () => {
  claimNamespace('ns-asserted');

  expect(() => assertNamespaceAvailable('ns-asserted')).toThrow('ns-asserted');
  expect(() => assertNamespaceAvailable('ns-not-claimed')).not.toThrow();
  expect(() => claimNamespace('ns-not-claimed')).not.toThrow();
  releaseNamespace('ns-not-claimed');
});

it('allows a namespace to be claimed again after it is released', () => {
  claimNamespace('ns-released');
  releaseNamespace('ns-released');

  expect(() => claimNamespace('ns-released')).not.toThrow();
});

it('ignores releasing a namespace that is not claimed', () => {
  expect(() => releaseNamespace('ns-never-claimed')).not.toThrow();
});
