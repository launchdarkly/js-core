/**
 * @jest-environment jsdom
 */
import { mount } from '@vue/test-utils';
import { h, nextTick } from 'vue';

import { createLDProviderWithClient } from '../../src/client/provider/LDProvider';
import { makeMockClient } from './mockClient';

it('renders the default slot when no gating slots are provided', () => {
  const { client } = makeMockClient({ ready: false, initializedState: 'initializing' });
  const Provider = createLDProviderWithClient(client);

  const wrapper = mount(Provider, { slots: { default: () => h('div', 'app') } });

  expect(wrapper.text()).toBe('app');
});

it('renders the #initializing slot while initializing, then the default slot once complete', async () => {
  const { client, controls } = makeMockClient({ ready: false, initializedState: 'initializing' });
  const Provider = createLDProviderWithClient(client);

  const wrapper = mount(Provider, {
    slots: {
      default: () => h('div', 'app'),
      initializing: () => h('div', 'loading'),
    },
  });

  expect(wrapper.text()).toBe('loading');

  controls.emitInitStatus({ status: 'complete' });
  await nextTick();

  expect(wrapper.text()).toBe('app');
});

it('renders the #failed slot with the error when initialization fails', async () => {
  const { client, controls } = makeMockClient({ ready: false, initializedState: 'initializing' });
  const Provider = createLDProviderWithClient(client);

  const wrapper = mount(Provider, {
    slots: {
      default: () => h('div', 'app'),
      failed: (props: { error?: Error }) => h('div', `failed:${props.error?.message}`),
    },
  });

  controls.emitInitStatus({ status: 'failed', error: new Error('bad-key') });
  await nextTick();

  expect(wrapper.text()).toBe('failed:bad-key');
});

it('unsubscribes from the client on unmount', () => {
  const { client, controls } = makeMockClient();
  const Provider = createLDProviderWithClient(client);

  const wrapper = mount(Provider, { slots: { default: () => h('div', 'app') } });
  expect(controls.subscriberCount()).toBe(2);

  wrapper.unmount();

  expect(controls.subscriberCount()).toBe(0);
});
