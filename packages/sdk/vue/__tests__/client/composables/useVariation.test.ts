/**
 * @jest-environment jsdom
 */
import type { LDVueClient } from '../../../src/client/LDClient';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref, type Component } from 'vue';

import {
  useBoolVariation,
  useJsonVariation,
  useNumberVariation,
  useStringVariation,
} from '../../../src/client/composables';
import { createLDProviderWithClient } from '../../../src/client/provider/LDProvider';
import { makeMockClient } from '../mockClient';

function mountUnderProvider(client: LDVueClient, child: Component) {
  const Provider = createLDProviderWithClient(client);
  return mount(Provider, { slots: { default: () => h(child) } });
}

// useBoolVariation

it('useBoolVariation calls client.boolVariation with key and defaultValue', () => {
  const { client } = makeMockClient({ boolValue: true });
  (client.boolVariation as jest.Mock).mockReturnValue(true);

  const Child = defineComponent({
    setup() {
      const flag = useBoolVariation('my-flag', false);
      return () => h('div', String(flag.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);

  expect(client.boolVariation).toHaveBeenCalledWith('my-flag', false);
  expect(wrapper.text()).toBe('true');
});

it('useBoolVariation evaluates exactly once on mount (no duplicate analytics impression)', () => {
  const { client } = makeMockClient({ boolValue: true });

  const Child = defineComponent({
    setup() {
      useBoolVariation('my-flag', false);
      return () => h('div');
    },
  });

  mountUnderProvider(client, Child);

  expect(client.boolVariation).toHaveBeenCalledTimes(1);
});

it('useBoolVariation subscribes to change:<key> on mount and unsubscribes on unmount', () => {
  const { client, controls } = makeMockClient();

  const Child = defineComponent({
    setup() {
      useBoolVariation('my-flag', false);
      return () => h('div');
    },
  });

  const wrapper = mountUnderProvider(client, Child);
  expect(controls.handlerCount('change:my-flag')).toBe(1);

  wrapper.unmount();
  expect(controls.handlerCount('change:my-flag')).toBe(0);
});

it('useBoolVariation re-renders with new value when change:<key> fires', async () => {
  const { client, controls } = makeMockClient({ boolValue: false });

  const Child = defineComponent({
    setup() {
      const flag = useBoolVariation('my-flag', false);
      return () => h('div', String(flag.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);
  expect(wrapper.text()).toBe('false');

  controls.setBool(true);
  (client.boolVariation as jest.Mock).mockReturnValue(true);
  controls.emitChange('my-flag');
  await nextTick();

  expect(wrapper.text()).toBe('true');
});

it('useBoolVariation does not call variation when not ready', () => {
  const { client } = makeMockClient({ ready: false, initializedState: 'initializing' });

  const Child = defineComponent({
    setup() {
      useBoolVariation('my-flag', false);
      return () => h('div');
    },
  });

  mountUnderProvider(client, Child);

  expect(client.boolVariation).not.toHaveBeenCalled();
});

it('useBoolVariation returns defaultValue when not ready', () => {
  const { client } = makeMockClient({ ready: false, initializedState: 'initializing' });
  (client.boolVariation as jest.Mock).mockReturnValue(true);

  const Child = defineComponent({
    setup() {
      const flag = useBoolVariation('my-flag', false);
      return () => h('div', String(flag.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);

  expect(wrapper.text()).toBe('false');
});

it('useBoolVariation evaluates once when initialization completes', async () => {
  const { client, controls } = makeMockClient({ ready: false, initializedState: 'initializing' });
  (client.boolVariation as jest.Mock).mockReturnValue(true);

  const Child = defineComponent({
    setup() {
      const flag = useBoolVariation('my-flag', false);
      return () => h('div', String(flag.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);
  expect(wrapper.text()).toBe('false');
  expect(client.boolVariation).not.toHaveBeenCalled();

  // start() resolving to complete flips the client to ready and notifies context
  // subscribers; the composable re-evaluates via its onContextChange subscription.
  controls.emitInitStatus({ status: 'complete' });
  controls.emitContextChange({ kind: 'user', key: 'context-key' });
  await nextTick();

  expect(client.boolVariation).toHaveBeenCalledTimes(1);
  expect(wrapper.text()).toBe('true');
});

it('useBoolVariation evaluates when initialization fails (client returns defaults on failure)', async () => {
  const { client, controls } = makeMockClient({ ready: false, initializedState: 'initializing' });
  (client.boolVariation as jest.Mock).mockReturnValue(false);

  const Child = defineComponent({
    setup() {
      const flag = useBoolVariation('my-flag', false);
      return () => h('div', String(flag.value));
    },
  });

  mountUnderProvider(client, Child);
  expect(client.boolVariation).not.toHaveBeenCalled();

  // A failed start() still resolves (failure is a resolved result, not a rejection), so the
  // base client notifies context subscribers exactly once. The composable must re-evaluate
  // exactly once via onContextChange, not a second time via any init-status subscription
  // (SDK-2640 double-eval-on-failure guard).
  controls.emitInitStatus({ status: 'failed', error: new Error('network error') });
  controls.emitContextChange({ kind: 'user', key: 'context-key' });
  await nextTick();

  expect(client.boolVariation).toHaveBeenCalledTimes(1);
});

it('useBoolVariation re-evaluates when context changes after identify', async () => {
  const { client, controls } = makeMockClient();
  (client.boolVariation as jest.Mock).mockReturnValue(true);

  const Child = defineComponent({
    setup() {
      const flag = useBoolVariation('my-flag', false);
      return () => h('div', String(flag.value));
    },
  });

  mountUnderProvider(client, Child);
  const callsBefore = (client.boolVariation as jest.Mock).mock.calls.length;

  controls.emitContextChange({ kind: 'user', key: 'new-user' });
  await nextTick();

  expect((client.boolVariation as jest.Mock).mock.calls.length).toBe(callsBefore + 1);
});

it('useBoolVariation evaluates twice when a single identify changes BOTH context and the flag value', async () => {
  const { client, controls } = makeMockClient();
  (client.boolVariation as jest.Mock).mockReturnValue(true);

  const Child = defineComponent({
    setup() {
      const flag = useBoolVariation('my-flag', false);
      return () => h('div', String(flag.value));
    },
  });

  mountUnderProvider(client, Child);
  (client.boolVariation as jest.Mock).mockClear();

  // A single identify() that changes both the context and the watched flag's value fires
  // change:<key> (flag-value trigger) and notifies context subscribers (context trigger).
  // Each fires update() once -> two evaluations. Accepted react-parity cost (SDK-2194): the
  // flagChanged counter that used to batch these into one flush is gone.
  controls.emitChange('my-flag');
  controls.emitContextChange({ kind: 'user', key: 'new-user' });
  await nextTick();

  expect(client.boolVariation as jest.Mock).toHaveBeenCalledTimes(2);
});

it('useBoolVariation evaluates exactly once when ONLY the flag value changes', async () => {
  const { client, controls } = makeMockClient();
  (client.boolVariation as jest.Mock).mockReturnValue(true);

  const Child = defineComponent({
    setup() {
      const flag = useBoolVariation('my-flag', false);
      return () => h('div', String(flag.value));
    },
  });

  mountUnderProvider(client, Child);
  (client.boolVariation as jest.Mock).mockClear();

  controls.emitChange('my-flag');
  await nextTick();

  expect(client.boolVariation as jest.Mock).toHaveBeenCalledTimes(1);
});

it('useBoolVariation evaluates exactly once when ONLY the context changes', async () => {
  const { client, controls } = makeMockClient();
  (client.boolVariation as jest.Mock).mockReturnValue(true);

  const Child = defineComponent({
    setup() {
      const flag = useBoolVariation('my-flag', false);
      return () => h('div', String(flag.value));
    },
  });

  mountUnderProvider(client, Child);
  (client.boolVariation as jest.Mock).mockClear();

  controls.emitContextChange({ kind: 'user', key: 'new-user' });
  await nextTick();

  expect(client.boolVariation as jest.Mock).toHaveBeenCalledTimes(1);
});

it('useBoolVariation re-evaluates and re-subscribes when key changes', async () => {
  const { client, controls } = makeMockClient();
  (client.boolVariation as jest.Mock).mockImplementation((k: string, def: boolean) => {
    if (k === 'flag-a') return false;
    if (k === 'flag-b') return true;
    return def;
  });

  const flagKey = ref('flag-a');

  const Child = defineComponent({
    setup() {
      const flag = useBoolVariation(flagKey, false);
      return () => h('div', String(flag.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);
  expect(wrapper.text()).toBe('false');
  expect(controls.handlerCount('change:flag-a')).toBe(1);
  expect(controls.handlerCount('change:flag-b')).toBe(0);

  flagKey.value = 'flag-b';
  await nextTick();

  expect(wrapper.text()).toBe('true');
  expect(controls.handlerCount('change:flag-a')).toBe(0);
  expect(controls.handlerCount('change:flag-b')).toBe(1);
});

// useStringVariation

it('useStringVariation calls client.stringVariation with key and defaultValue', () => {
  const { client } = makeMockClient();
  (client.stringVariation as jest.Mock).mockReturnValue('hello');

  const Child = defineComponent({
    setup() {
      const flag = useStringVariation('my-flag', 'default');
      return () => h('div', flag.value);
    },
  });

  const wrapper = mountUnderProvider(client, Child);

  expect(client.stringVariation).toHaveBeenCalledWith('my-flag', 'default');
  expect(wrapper.text()).toBe('hello');
});

it('useStringVariation subscribes to change:<key> on mount and unsubscribes on unmount', () => {
  const { client, controls } = makeMockClient();

  const Child = defineComponent({
    setup() {
      useStringVariation('my-flag', 'default');
      return () => h('div');
    },
  });

  const wrapper = mountUnderProvider(client, Child);
  expect(controls.handlerCount('change:my-flag')).toBe(1);

  wrapper.unmount();
  expect(controls.handlerCount('change:my-flag')).toBe(0);
});

it('useStringVariation re-renders with new value when change:<key> fires', async () => {
  const { client, controls } = makeMockClient();
  (client.stringVariation as jest.Mock).mockReturnValue('before');

  const Child = defineComponent({
    setup() {
      const flag = useStringVariation('my-flag', 'default');
      return () => h('div', flag.value);
    },
  });

  const wrapper = mountUnderProvider(client, Child);
  expect(wrapper.text()).toBe('before');

  (client.stringVariation as jest.Mock).mockReturnValue('after');
  controls.emitChange('my-flag');
  await nextTick();

  expect(wrapper.text()).toBe('after');
});

it('useStringVariation re-evaluates when context changes after identify', async () => {
  const { client, controls } = makeMockClient();
  (client.stringVariation as jest.Mock).mockReturnValue('value');

  const Child = defineComponent({
    setup() {
      useStringVariation('my-flag', 'default');
      return () => h('div');
    },
  });

  mountUnderProvider(client, Child);
  const callsBefore = (client.stringVariation as jest.Mock).mock.calls.length;

  controls.emitContextChange({ kind: 'user', key: 'new-user' });
  await nextTick();

  expect((client.stringVariation as jest.Mock).mock.calls.length).toBe(callsBefore + 1);
});

// useNumberVariation

it('useNumberVariation calls client.numberVariation with key and defaultValue', () => {
  const { client } = makeMockClient();
  (client.numberVariation as jest.Mock).mockReturnValue(42);

  const Child = defineComponent({
    setup() {
      const flag = useNumberVariation('my-flag', 0);
      return () => h('div', String(flag.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);

  expect(client.numberVariation).toHaveBeenCalledWith('my-flag', 0);
  expect(wrapper.text()).toBe('42');
});

it('useNumberVariation subscribes to change:<key> on mount and unsubscribes on unmount', () => {
  const { client, controls } = makeMockClient();

  const Child = defineComponent({
    setup() {
      useNumberVariation('my-flag', 0);
      return () => h('div');
    },
  });

  const wrapper = mountUnderProvider(client, Child);
  expect(controls.handlerCount('change:my-flag')).toBe(1);

  wrapper.unmount();
  expect(controls.handlerCount('change:my-flag')).toBe(0);
});

it('useNumberVariation re-renders with new value when change:<key> fires', async () => {
  const { client, controls } = makeMockClient();
  (client.numberVariation as jest.Mock).mockReturnValue(1);

  const Child = defineComponent({
    setup() {
      const flag = useNumberVariation('my-flag', 0);
      return () => h('div', String(flag.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);
  expect(wrapper.text()).toBe('1');

  (client.numberVariation as jest.Mock).mockReturnValue(99);
  controls.emitChange('my-flag');
  await nextTick();

  expect(wrapper.text()).toBe('99');
});

it('useNumberVariation re-evaluates when context changes after identify', async () => {
  const { client, controls } = makeMockClient();
  (client.numberVariation as jest.Mock).mockReturnValue(5);

  const Child = defineComponent({
    setup() {
      useNumberVariation('my-flag', 0);
      return () => h('div');
    },
  });

  mountUnderProvider(client, Child);
  const callsBefore = (client.numberVariation as jest.Mock).mock.calls.length;

  controls.emitContextChange({ kind: 'user', key: 'new-user' });
  await nextTick();

  expect((client.numberVariation as jest.Mock).mock.calls.length).toBe(callsBefore + 1);
});

// useJsonVariation

it('useJsonVariation calls client.jsonVariation with key and defaultValue', () => {
  const { client } = makeMockClient();
  const result = { enabled: true };
  (client.jsonVariation as jest.Mock).mockReturnValue(result);

  const Child = defineComponent({
    setup() {
      const flag = useJsonVariation('my-flag', {});
      return () => h('div', JSON.stringify(flag.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);

  expect(client.jsonVariation).toHaveBeenCalledWith('my-flag', {});
  expect(wrapper.text()).toBe(JSON.stringify(result));
});

it('useJsonVariation subscribes to change:<key> on mount and unsubscribes on unmount', () => {
  const { client, controls } = makeMockClient();

  const Child = defineComponent({
    setup() {
      useJsonVariation('my-flag', {});
      return () => h('div');
    },
  });

  const wrapper = mountUnderProvider(client, Child);
  expect(controls.handlerCount('change:my-flag')).toBe(1);

  wrapper.unmount();
  expect(controls.handlerCount('change:my-flag')).toBe(0);
});

it('useJsonVariation re-renders with new value when change:<key> fires', async () => {
  const { client, controls } = makeMockClient();
  (client.jsonVariation as jest.Mock).mockReturnValue({ x: 1 });

  const Child = defineComponent({
    setup() {
      const flag = useJsonVariation('my-flag', {});
      return () => h('div', JSON.stringify(flag.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);
  expect(wrapper.text()).toBe('{"x":1}');

  (client.jsonVariation as jest.Mock).mockReturnValue({ x: 2 });
  controls.emitChange('my-flag');
  await nextTick();

  expect(wrapper.text()).toBe('{"x":2}');
});

it('useJsonVariation re-evaluates when context changes after identify', async () => {
  const { client, controls } = makeMockClient();
  (client.jsonVariation as jest.Mock).mockReturnValue({ value: 'a' });

  const Child = defineComponent({
    setup() {
      useJsonVariation('my-flag', {});
      return () => h('div');
    },
  });

  mountUnderProvider(client, Child);
  const callsBefore = (client.jsonVariation as jest.Mock).mock.calls.length;

  controls.emitContextChange({ kind: 'user', key: 'new-user' });
  await nextTick();

  expect((client.jsonVariation as jest.Mock).mock.calls.length).toBe(callsBefore + 1);
});
