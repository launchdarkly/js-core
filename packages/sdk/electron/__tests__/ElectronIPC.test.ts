import { deriveNamespace } from '../src/deriveNamespace';
import { getIPCChannelName } from '../src/ElectronIPC';

it('derives namespace from credential alone', () => {
  expect(deriveNamespace('mob-abc-123')).toBe('mob-abc-123');
});

it('derives namespace from credential with custom namespace', () => {
  expect(deriveNamespace('mob-abc-123', 'my-namespace')).toBe('my-namespace:mob-abc-123');
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
