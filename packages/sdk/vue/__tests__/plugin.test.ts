/**
 * @jest-environment jsdom
 */
import { createApp, defineComponent, h, nextTick } from 'vue';

import { useBoolVariation, useInitializationStatus, useLDClient } from '../src/client/composables';
import { createLDVueInstanceKey } from '../src/client/provider/LDVueContext';
import { LDVuePlugin, type LDVuePluginOptions } from '../src/plugin';
import { makeMockClient } from './client/mockClient';

jest.mock('../src/client/LDVueClient', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '../src/client/LDVueClient';

const createClientMock = createClient as jest.Mock;

beforeEach(() => {
  createClientMock.mockReset();
});

function makeApp(options: LDVuePluginOptions) {
  const app = createApp(defineComponent({ render: () => h('div') }));
  app.use(LDVuePlugin, options);
  return app;
}

it('creates a client and provides it app-wide', () => {
  const { client } = makeMockClient();
  createClientMock.mockReturnValue(client);

  let injected: unknown;
  const Child = defineComponent({
    setup() {
      injected = useLDClient();
      return () => h('div');
    },
  });

  const app = createApp(Child);
  app.use(LDVuePlugin, {
    clientSideID: 'env-id',
    context: { kind: 'user', key: 'k' },
  });
  app.mount(document.createElement('div'));

  expect(injected).toBe(client);
});

it('starts the client automatically when deferInitialization is not set', () => {
  const { client } = makeMockClient();
  createClientMock.mockReturnValue(client);

  makeApp({ clientSideID: 'env-id', context: { kind: 'user', key: 'k' } });

  expect(client.start).toHaveBeenCalledTimes(1);
});

it('does not start the client when deferInitialization is true', () => {
  const { client } = makeMockClient();
  createClientMock.mockReturnValue(client);

  makeApp({ clientSideID: 'env-id', context: { kind: 'user', key: 'k' }, deferInitialization: true });

  expect(client.start).not.toHaveBeenCalled();
});

it('merges top-level bootstrap into startOptions and starts with it', () => {
  const { client } = makeMockClient();
  createClientMock.mockReturnValue(client);
  const bootstrap = { 'my-flag': true };

  makeApp({ clientSideID: 'env-id', context: { kind: 'user', key: 'k' }, bootstrap });

  expect(client.start).toHaveBeenCalledWith(expect.objectContaining({ bootstrap }));
});

it('top-level bootstrap takes precedence over startOptions.bootstrap', () => {
  const { client } = makeMockClient();
  createClientMock.mockReturnValue(client);
  const topLevel = { 'my-flag': true };
  const startLevel = { 'my-flag': false };

  makeApp({
    clientSideID: 'env-id',
    context: { kind: 'user', key: 'k' },
    bootstrap: topLevel,
    startOptions: { bootstrap: startLevel },
  });

  expect(client.start).toHaveBeenCalledWith(expect.objectContaining({ bootstrap: topLevel }));
});

it('reactively reflects initialization status via useInitializationStatus', async () => {
  const { client, controls } = makeMockClient({ ready: false, initializedState: 'initializing' });
  createClientMock.mockReturnValue(client);

  let status: string | undefined;
  const Child = defineComponent({
    setup() {
      const s = useInitializationStatus();
      return () => {
        status = s.value.status;
        return h('div');
      };
    },
  });

  const app = createApp(Child);
  app.use(LDVuePlugin, { clientSideID: 'env-id', context: { kind: 'user', key: 'k' } });
  app.mount(document.createElement('div'));

  expect(status).toBe('initializing');

  controls.emitInitStatus({ status: 'complete' });
  await nextTick();

  expect(status).toBe('complete');
});

it('provides via a custom injection key when specified', () => {
  const { client } = makeMockClient();
  createClientMock.mockReturnValue(client);
  const key = createLDVueInstanceKey();

  let injected: unknown;
  const Child = defineComponent({
    setup() {
      injected = useLDClient(key);
      return () => h('div');
    },
  });

  const app = createApp(Child);
  app.use(LDVuePlugin, { clientSideID: 'env-id', context: { kind: 'user', key: 'k' }, injectionKey: key });
  app.mount(document.createElement('div'));

  expect(injected).toBe(client);
});

it('evaluates flags via useBoolVariation under the plugin', () => {
  const { client } = makeMockClient({ boolValue: true });
  createClientMock.mockReturnValue(client);

  let flagValue: boolean | undefined;
  const Child = defineComponent({
    setup() {
      const flag = useBoolVariation('my-flag', false);
      return () => {
        flagValue = flag.value;
        return h('div');
      };
    },
  });

  const app = createApp(Child);
  app.use(LDVuePlugin, { clientSideID: 'env-id', context: { kind: 'user', key: 'k' } });
  app.mount(document.createElement('div'));

  expect(flagValue).toBe(true);
  expect(client.boolVariation).toHaveBeenCalledWith('my-flag', false);
});
