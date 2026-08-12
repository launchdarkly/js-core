/**
 * @jest-environment jsdom
 */
import type { LDVueClient } from '../../src/client/LDClient';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, type Component } from 'vue';

import {
  useBoolVariation,
  useInitializationStatus,
  useLDClient,
} from '../../src/client/composables';
import { createLDProviderWithClient } from '../../src/client/provider/LDProvider';
import { makeMockClient } from './mockClient';

function mountUnderProvider(client: LDVueClient, child: Component) {
  const Provider = createLDProviderWithClient(client);
  return mount(Provider, { slots: { default: () => h(child) } });
}

it('useBoolVariation returns the evaluated value when ready', () => {
  const { client, controls } = makeMockClient({ boolValue: true });
  const Child = defineComponent({
    setup() {
      const flag = useBoolVariation('flag', false);
      return () => h('div', String(flag.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);

  expect(wrapper.text()).toBe('true');
  expect(client.boolVariation as unknown as jest.Mock).toHaveBeenCalledWith('flag', false);
  expect(controls.handlerCount('change:flag')).toBe(1);
});

it('re-evaluates when the flag changes', async () => {
  const { client, controls } = makeMockClient({ boolValue: true });
  const Child = defineComponent({
    setup() {
      const flag = useBoolVariation('flag', false);
      return () => h('div', String(flag.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);
  expect(wrapper.text()).toBe('true');

  controls.setBool(false);
  controls.emitChange('flag');
  await nextTick();

  expect(wrapper.text()).toBe('false');
});

it('does not evaluate before the client is ready', () => {
  const { client } = makeMockClient({ ready: false, initializedState: 'initializing' });
  const Child = defineComponent({
    setup() {
      const flag = useBoolVariation('flag', false);
      return () => h('div', String(flag.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);

  expect(wrapper.text()).toBe('false');
  expect(client.boolVariation as unknown as jest.Mock).not.toHaveBeenCalled();
});

it('cleans up the change listener on unmount', () => {
  const { client, controls } = makeMockClient();
  const Child = defineComponent({
    setup() {
      useBoolVariation('flag', false);
      return () => h('div');
    },
  });

  const wrapper = mountUnderProvider(client, Child);
  expect(controls.handlerCount('change:flag')).toBe(1);

  wrapper.unmount();
  expect(controls.handlerCount('change:flag')).toBe(0);
});

it('useInitializationStatus reflects status reactively', async () => {
  const { client, controls } = makeMockClient({ ready: false, initializedState: 'initializing' });
  const Child = defineComponent({
    setup() {
      const status = useInitializationStatus();
      return () => h('div', status.value.status);
    },
  });

  const wrapper = mountUnderProvider(client, Child);
  expect(wrapper.text()).toBe('initializing');

  controls.emitInitStatus({ status: 'complete' });
  await nextTick();
  expect(wrapper.text()).toBe('complete');
});

it('useInitializationStatus surfaces the error on failure', async () => {
  const { client, controls } = makeMockClient({ ready: false, initializedState: 'initializing' });
  const error = new Error('boom');
  const Child = defineComponent({
    setup() {
      const status = useInitializationStatus();
      return () =>
        h('div', status.value.status === 'failed' ? status.value.error.message : status.value.status);
    },
  });

  const wrapper = mountUnderProvider(client, Child);
  controls.emitInitStatus({ status: 'failed', error });
  await nextTick();

  expect(wrapper.text()).toBe('boom');
});

it('useLDClient returns the provided client', () => {
  const { client } = makeMockClient();
  let injected: unknown;
  const Child = defineComponent({
    setup() {
      injected = useLDClient();
      return () => h('div');
    },
  });

  mountUnderProvider(client, Child);
  expect(injected).toBe(client);
});

it('throws when used without a provider', () => {
  const Child = defineComponent({
    render: () => h('div'),
    setup() {
      useLDClient();
    },
  });

  expect(() => mount(Child)).toThrow(/LaunchDarkly client was not found/);
});

it('subscribes to onContextChange on mount and unsubscribes on scope dispose', () => {
  const { client, controls } = makeMockClient();
  const Child = defineComponent({
    setup() {
      useBoolVariation('flag', false);
      return () => h('div');
    },
  });

  // Provider adds one onContextChange subscriber; the composable adds a second.
  const wrapper = mountUnderProvider(client, Child);
  expect(controls.contextSubscriberCount()).toBe(2);

  // Unmounting disposes both scopes; every onContextChange subscription is removed.
  wrapper.unmount();
  expect(controls.contextSubscriberCount()).toBe(0);
});
