import { concatNamespacesAndValues } from '../../src/storage/namespaceUtils';

const mockHash = async (input: string) => `${input}Hashed`;
const noop = async (input: string) => input;

describe('concatNamespacesAndValues tests', () => {
  test('it handles one part', async () => {
    const result = await concatNamespacesAndValues([
      { value: 'LaunchDarkly', transform: mockHash },
    ]);

    expect(result).toEqual('LaunchDarklyHashed');
  });

  test('it handles empty parts', async () => {
    const result = await concatNamespacesAndValues([]);

    expect(result).toEqual('');
  });

  test('it handles many parts', async () => {
    const result = await concatNamespacesAndValues([
      { value: 'LaunchDarkly', transform: mockHash },
      { value: 'ContextKeys', transform: mockHash },
      { value: 'aKind', transform: mockHash },
    ]);

    expect(result).toEqual('LaunchDarklyHashed_ContextKeysHashed_aKindHashed');
  });

  test('it handles mixture of hashing and no hashing', async () => {
    const result = await concatNamespacesAndValues([
      { value: 'LaunchDarkly', transform: mockHash },
      { value: 'ContextKeys', transform: noop },
      { value: 'aKind', transform: mockHash },
    ]);

    expect(result).toEqual('LaunchDarklyHashed_ContextKeys_aKindHashed');
  });
});
