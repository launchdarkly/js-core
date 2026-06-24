/**
 * @jest-environment jsdom
 */
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { useLDClient } from '../../src/client/composables';
import { createLDProvider } from '../../src/client/provider/LDProvider';
import { makeMockClient } from './mockClient';

jest.mock('../../src/client/LDVueClient', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '../../src/client/LDVueClient';

const createClientMock = createClient as jest.Mock;

beforeEach(() => {
  createClientMock.mockReset();
});

it('creates a client internally and provides it to children', () => {
  const { client } = makeMockClient();
  createClientMock.mockReturnValue(client);

  let injected: unknown;
  const Child = defineComponent({
    setup() {
      injected = useLDClient();
      return () => h('div');
    },
  });

  const Provider = createLDProvider('env-id', { kind: 'user', key: 'k' });
  mount(Provider, { slots: { default: () => h(Child) } });

  expect(injected).toBe(client);
  expect(createClientMock).toHaveBeenCalledWith('env-id', { kind: 'user', key: 'k' }, undefined);
});

it('starts the client automatically by default', () => {
  const { client } = makeMockClient();
  createClientMock.mockReturnValue(client);

  const Provider = createLDProvider('env-id', { kind: 'user', key: 'k' });
  mount(Provider, { slots: { default: () => h('div') } });

  expect(client.start).toHaveBeenCalledTimes(1);
});

it('does not start the client when deferInitialization is true', () => {
  const { client } = makeMockClient();
  createClientMock.mockReturnValue(client);

  const Provider = createLDProvider('env-id', { kind: 'user', key: 'k' }, { deferInitialization: true });
  mount(Provider, { slots: { default: () => h('div') } });

  expect(client.start).not.toHaveBeenCalled();
});

it('merges top-level bootstrap into startOptions', () => {
  const { client } = makeMockClient();
  createClientMock.mockReturnValue(client);
  const bootstrap = { 'my-flag': true };

  const Provider = createLDProvider('env-id', { kind: 'user', key: 'k' }, { bootstrap });
  mount(Provider, { slots: { default: () => h('div') } });

  expect(client.start).toHaveBeenCalledWith(expect.objectContaining({ bootstrap }));
});

it('top-level bootstrap takes precedence over startOptions.bootstrap', () => {
  const { client } = makeMockClient();
  createClientMock.mockReturnValue(client);
  const topLevel = { 'my-flag': true };
  const startLevel = { 'my-flag': false };

  const Provider = createLDProvider(
    'env-id',
    { kind: 'user', key: 'k' },
    { bootstrap: topLevel, startOptions: { bootstrap: startLevel } },
  );
  mount(Provider, { slots: { default: () => h('div') } });

  expect(client.start).toHaveBeenCalledWith(expect.objectContaining({ bootstrap: topLevel }));
});

it('passes ldOptions to the client factory', () => {
  const { client } = makeMockClient();
  createClientMock.mockReturnValue(client);
  const ldOptions = { wrapperName: 'my-wrapper' };

  const Provider = createLDProvider('env-id', { kind: 'user', key: 'k' }, { ldOptions });
  mount(Provider, { slots: { default: () => h('div') } });

  expect(createClientMock).toHaveBeenCalledWith('env-id', { kind: 'user', key: 'k' }, ldOptions);
});
