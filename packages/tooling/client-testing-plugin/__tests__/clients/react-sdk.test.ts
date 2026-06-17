/**
 * @jest-environment jsdom
 */
import { createTestClient, createTestClientProvider } from '../../src/clients/react-sdk';
import TestData from '../../src/TestData';

it('seeds the TestData with initialFlags and resolves overrides after start', async () => {
  const { client, testData } = createTestClient(
    { kind: 'user', key: 'tester' },
    { 'bool-flag': true, greeting: 'hello' },
  );
  await client.start({ bootstrap: {} });

  expect(testData).toBeInstanceOf(TestData);
  expect(client.boolVariation('bool-flag', false)).toBe(true);
  expect(client.stringVariation('greeting', 'default')).toBe('hello');

  await client.close();
});

it('appends TestData to user-supplied plugins rather than replacing them', async () => {
  const userPluginRegisterDebug = jest.fn();
  const userPlugin = {
    getMetadata: () => ({ name: 'user-plugin' }),
    register: jest.fn(),
    registerDebug: userPluginRegisterDebug,
  };

  const { client } = createTestClient(
    { kind: 'user', key: 'tester' },
    { 'bool-flag': true },
    { plugins: [userPlugin] },
  );
  await client.start({ bootstrap: {} });

  expect(userPluginRegisterDebug).toHaveBeenCalled();
  expect(client.boolVariation('bool-flag', false)).toBe(true);

  await client.close();
});

it('createTestClientProvider returns a pre-wired Provider, client, and testData', async () => {
  const { Provider, client, testData } = await createTestClientProvider(
    { kind: 'user', key: 'tester' },
    { 'show-banner': true },
  );
  expect(Provider).toBeInstanceOf(Function);
  expect(client).toBeDefined();
  expect(testData).toBeInstanceOf(TestData);
  await client.close();
});

it('updates flag values dynamically via testData after the client is started', async () => {
  const { client, testData } = createTestClient(
    { kind: 'user', key: 'tester' },
    { 'show-banner': true },
  );
  await client.start({ bootstrap: {} });

  expect(client.boolVariation('show-banner', false)).toBe(true);

  testData.setBool('show-banner', false);
  expect(client.boolVariation('show-banner', true)).toBe(false);

  await client.close();
});
