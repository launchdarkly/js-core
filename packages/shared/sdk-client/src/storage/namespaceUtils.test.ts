import { concatNamespacesAndValues } from './namespaceUtils';

const mockHash = (input: string) => `${input}Hashed`;
const noop = (input: string) => input;

describe('concatNamespacesAndValues tests', () => {
  test('it handles one part', async () => {
    const result = concatNamespacesAndValues([{ value: 'LaunchDarkly', transform: mockHash }]);

    expect(result).toEqual('LaunchDarklyHashed');
  });

  test('it handles empty parts', async () => {
    const result = concatNamespacesAndValues([]);

    expect(result).toEqual('');
  });

  test('it handles many parts', async () => {
    const result = concatNamespacesAndValues([
      { value: 'LaunchDarkly', transform: mockHash },
      { value: 'ContextKeys', transform: mockHash },
      { value: 'aKind', transform: mockHash },
    ]);

    expect(result).toEqual('LaunchDarklyHashed_ContextKeysHashed_aKindHashed');
  });

  test('it handles mixture of hashing and no hashing', async () => {
    const result = concatNamespacesAndValues([
      { value: 'LaunchDarkly', transform: mockHash },
      { value: 'ContextKeys', transform: noop },
      { value: 'aKind', transform: mockHash },
    ]);

    expect(result).toEqual('LaunchDarklyHashed_ContextKeys_aKindHashed');
  });
});
