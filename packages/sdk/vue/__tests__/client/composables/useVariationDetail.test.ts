/**
 * @jest-environment jsdom
 */
import type { LDEvaluationDetailTyped } from '@launchdarkly/js-client-sdk';
import type { LDVueClient } from '../../../src/client/LDClient';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref, type Component } from 'vue';

import {
  useBoolVariationDetail,
  useJsonVariationDetail,
  useNumberVariationDetail,
  useStringVariationDetail,
} from '../../../src/client/composables';
import { createLDProviderWithClient } from '../../../src/client/provider/LDProvider';
import { makeMockClient } from '../mockClient';

function mountUnderProvider(client: LDVueClient, child: Component) {
  const Provider = createLDProviderWithClient(client);
  return mount(Provider, { slots: { default: () => h(child) } });
}

const NOT_READY_REASON = { kind: 'ERROR', errorKind: 'CLIENT_NOT_READY' } as const;

// useBoolVariationDetail

it('useBoolVariationDetail calls client.boolVariationDetail with key and defaultValue and returns full detail', () => {
  const { client } = makeMockClient();
  const detail: LDEvaluationDetailTyped<boolean> = {
    value: true,
    variationIndex: 0,
    reason: { kind: 'OFF' },
  };
  (client.boolVariationDetail as jest.Mock).mockReturnValue(detail);

  const Child = defineComponent({
    setup() {
      const d = useBoolVariationDetail('my-flag', false);
      return () => h('div', JSON.stringify(d.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);

  expect(client.boolVariationDetail).toHaveBeenCalledWith('my-flag', false);
  expect(wrapper.text()).toBe(JSON.stringify(detail));
});

it('useBoolVariationDetail subscribes to change:<key> on mount and unsubscribes on unmount', () => {
  const { client, controls } = makeMockClient();
  (client.boolVariationDetail as jest.Mock).mockReturnValue({
    value: false,
    variationIndex: 0,
    reason: { kind: 'OFF' },
  });

  const Child = defineComponent({
    setup() {
      useBoolVariationDetail('my-flag', false);
      return () => h('div');
    },
  });

  const wrapper = mountUnderProvider(client, Child);
  expect(controls.handlerCount('change:my-flag')).toBe(1);

  wrapper.unmount();
  expect(controls.handlerCount('change:my-flag')).toBe(0);
});

it('useBoolVariationDetail re-renders with updated detail when change:<key> fires', async () => {
  const { client, controls } = makeMockClient();
  const initialDetail: LDEvaluationDetailTyped<boolean> = {
    value: false,
    variationIndex: 0,
    reason: { kind: 'OFF' },
  };
  const updatedDetail: LDEvaluationDetailTyped<boolean> = {
    value: true,
    variationIndex: 1,
    reason: { kind: 'FALLTHROUGH' },
  };
  (client.boolVariationDetail as jest.Mock).mockReturnValue(initialDetail);

  const Child = defineComponent({
    setup() {
      const d = useBoolVariationDetail('my-flag', false);
      return () => h('div', JSON.stringify(d.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);
  expect(wrapper.text()).toBe(JSON.stringify(initialDetail));

  (client.boolVariationDetail as jest.Mock).mockReturnValue(updatedDetail);
  controls.emitChange('my-flag');
  await nextTick();

  expect(wrapper.text()).toBe(JSON.stringify(updatedDetail));
});

it('useBoolVariationDetail re-evaluates when context changes after identify', async () => {
  const { client, controls } = makeMockClient();
  (client.boolVariationDetail as jest.Mock).mockReturnValue({
    value: true,
    variationIndex: 0,
    reason: { kind: 'OFF' },
  });

  const Child = defineComponent({
    setup() {
      useBoolVariationDetail('my-flag', false);
      return () => h('div');
    },
  });

  mountUnderProvider(client, Child);
  const callsBefore = (client.boolVariationDetail as jest.Mock).mock.calls.length;

  controls.emitContextChange({ kind: 'user', key: 'new-user' });
  await nextTick();

  expect((client.boolVariationDetail as jest.Mock).mock.calls.length).toBe(callsBefore + 1);
});

it('useBoolVariationDetail returns CLIENT_NOT_READY detail when not ready', () => {
  const { client } = makeMockClient({ ready: false, initializedState: 'initializing' });

  const Child = defineComponent({
    setup() {
      const d = useBoolVariationDetail('my-flag', false);
      return () => h('div', JSON.stringify(d.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);

  expect(client.boolVariationDetail).not.toHaveBeenCalled();
  const rendered = JSON.parse(wrapper.text()) as LDEvaluationDetailTyped<boolean>;
  expect(rendered.value).toBe(false);
  expect(rendered.variationIndex).toBeNull();
  expect(rendered.reason).toEqual(NOT_READY_REASON);
});

// useStringVariationDetail

it('useStringVariationDetail calls client.stringVariationDetail with key and defaultValue and returns full detail', () => {
  const { client } = makeMockClient();
  const detail: LDEvaluationDetailTyped<string> = {
    value: 'on',
    variationIndex: 1,
    reason: { kind: 'RULE_MATCH', ruleIndex: 0, ruleId: 'r1' },
  };
  (client.stringVariationDetail as jest.Mock).mockReturnValue(detail);

  const Child = defineComponent({
    setup() {
      const d = useStringVariationDetail('my-flag', 'off');
      return () => h('div', JSON.stringify(d.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);

  expect(client.stringVariationDetail).toHaveBeenCalledWith('my-flag', 'off');
  expect(wrapper.text()).toBe(JSON.stringify(detail));
});

it('useStringVariationDetail subscribes to change:<key> on mount and unsubscribes on unmount', () => {
  const { client, controls } = makeMockClient();
  (client.stringVariationDetail as jest.Mock).mockReturnValue({
    value: 'off',
    variationIndex: 0,
    reason: { kind: 'OFF' },
  });

  const Child = defineComponent({
    setup() {
      useStringVariationDetail('my-flag', 'off');
      return () => h('div');
    },
  });

  const wrapper = mountUnderProvider(client, Child);
  expect(controls.handlerCount('change:my-flag')).toBe(1);

  wrapper.unmount();
  expect(controls.handlerCount('change:my-flag')).toBe(0);
});

it('useStringVariationDetail re-renders with updated detail when change:<key> fires', async () => {
  const { client, controls } = makeMockClient();
  const initialDetail: LDEvaluationDetailTyped<string> = {
    value: 'before',
    variationIndex: 0,
    reason: { kind: 'OFF' },
  };
  const updatedDetail: LDEvaluationDetailTyped<string> = {
    value: 'after',
    variationIndex: 1,
    reason: { kind: 'FALLTHROUGH' },
  };
  (client.stringVariationDetail as jest.Mock).mockReturnValue(initialDetail);

  const Child = defineComponent({
    setup() {
      const d = useStringVariationDetail('my-flag', 'default');
      return () => h('div', JSON.stringify(d.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);
  expect(wrapper.text()).toBe(JSON.stringify(initialDetail));

  (client.stringVariationDetail as jest.Mock).mockReturnValue(updatedDetail);
  controls.emitChange('my-flag');
  await nextTick();

  expect(wrapper.text()).toBe(JSON.stringify(updatedDetail));
});

it('useStringVariationDetail re-evaluates when context changes after identify', async () => {
  const { client, controls } = makeMockClient();
  (client.stringVariationDetail as jest.Mock).mockReturnValue({
    value: 'value',
    variationIndex: 0,
    reason: { kind: 'OFF' },
  });

  const Child = defineComponent({
    setup() {
      useStringVariationDetail('my-flag', 'default');
      return () => h('div');
    },
  });

  mountUnderProvider(client, Child);
  const callsBefore = (client.stringVariationDetail as jest.Mock).mock.calls.length;

  controls.emitContextChange({ kind: 'user', key: 'new-user' });
  await nextTick();

  expect((client.stringVariationDetail as jest.Mock).mock.calls.length).toBe(callsBefore + 1);
});

it('useStringVariationDetail returns CLIENT_NOT_READY detail when not ready', () => {
  const { client } = makeMockClient({ ready: false, initializedState: 'initializing' });

  const Child = defineComponent({
    setup() {
      const d = useStringVariationDetail('my-flag', 'default');
      return () => h('div', JSON.stringify(d.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);

  expect(client.stringVariationDetail).not.toHaveBeenCalled();
  const rendered = JSON.parse(wrapper.text()) as LDEvaluationDetailTyped<string>;
  expect(rendered.value).toBe('default');
  expect(rendered.variationIndex).toBeNull();
  expect(rendered.reason).toEqual(NOT_READY_REASON);
});

// useNumberVariationDetail

it('useNumberVariationDetail calls client.numberVariationDetail with key and defaultValue and returns full detail', () => {
  const { client } = makeMockClient();
  const detail: LDEvaluationDetailTyped<number> = {
    value: 99,
    variationIndex: 2,
    reason: { kind: 'FALLTHROUGH' },
  };
  (client.numberVariationDetail as jest.Mock).mockReturnValue(detail);

  const Child = defineComponent({
    setup() {
      const d = useNumberVariationDetail('my-flag', 0);
      return () => h('div', JSON.stringify(d.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);

  expect(client.numberVariationDetail).toHaveBeenCalledWith('my-flag', 0);
  expect(wrapper.text()).toBe(JSON.stringify(detail));
});

it('useNumberVariationDetail subscribes to change:<key> on mount and unsubscribes on unmount', () => {
  const { client, controls } = makeMockClient();
  (client.numberVariationDetail as jest.Mock).mockReturnValue({
    value: 0,
    variationIndex: 0,
    reason: { kind: 'OFF' },
  });

  const Child = defineComponent({
    setup() {
      useNumberVariationDetail('my-flag', 0);
      return () => h('div');
    },
  });

  const wrapper = mountUnderProvider(client, Child);
  expect(controls.handlerCount('change:my-flag')).toBe(1);

  wrapper.unmount();
  expect(controls.handlerCount('change:my-flag')).toBe(0);
});

it('useNumberVariationDetail re-renders with updated detail when change:<key> fires', async () => {
  const { client, controls } = makeMockClient();
  const initialDetail: LDEvaluationDetailTyped<number> = {
    value: 1,
    variationIndex: 0,
    reason: { kind: 'OFF' },
  };
  const updatedDetail: LDEvaluationDetailTyped<number> = {
    value: 99,
    variationIndex: 1,
    reason: { kind: 'FALLTHROUGH' },
  };
  (client.numberVariationDetail as jest.Mock).mockReturnValue(initialDetail);

  const Child = defineComponent({
    setup() {
      const d = useNumberVariationDetail('my-flag', 0);
      return () => h('div', JSON.stringify(d.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);
  expect(wrapper.text()).toBe(JSON.stringify(initialDetail));

  (client.numberVariationDetail as jest.Mock).mockReturnValue(updatedDetail);
  controls.emitChange('my-flag');
  await nextTick();

  expect(wrapper.text()).toBe(JSON.stringify(updatedDetail));
});

it('useNumberVariationDetail re-evaluates when context changes after identify', async () => {
  const { client, controls } = makeMockClient();
  (client.numberVariationDetail as jest.Mock).mockReturnValue({
    value: 5,
    variationIndex: 0,
    reason: { kind: 'OFF' },
  });

  const Child = defineComponent({
    setup() {
      useNumberVariationDetail('my-flag', 0);
      return () => h('div');
    },
  });

  mountUnderProvider(client, Child);
  const callsBefore = (client.numberVariationDetail as jest.Mock).mock.calls.length;

  controls.emitContextChange({ kind: 'user', key: 'new-user' });
  await nextTick();

  expect((client.numberVariationDetail as jest.Mock).mock.calls.length).toBe(callsBefore + 1);
});

it('useNumberVariationDetail returns CLIENT_NOT_READY detail when not ready', () => {
  const { client } = makeMockClient({ ready: false, initializedState: 'initializing' });

  const Child = defineComponent({
    setup() {
      const d = useNumberVariationDetail('my-flag', 0);
      return () => h('div', JSON.stringify(d.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);

  expect(client.numberVariationDetail).not.toHaveBeenCalled();
  const rendered = JSON.parse(wrapper.text()) as LDEvaluationDetailTyped<number>;
  expect(rendered.value).toBe(0);
  expect(rendered.variationIndex).toBeNull();
  expect(rendered.reason).toEqual(NOT_READY_REASON);
});

// useJsonVariationDetail

it('useJsonVariationDetail calls client.jsonVariationDetail with key and defaultValue and returns full detail', () => {
  const { client } = makeMockClient();
  const detail: LDEvaluationDetailTyped<object> = {
    value: { x: 1 },
    variationIndex: 0,
    reason: { kind: 'OFF' },
  };
  (client.jsonVariationDetail as jest.Mock).mockReturnValue(detail);

  const Child = defineComponent({
    setup() {
      const d = useJsonVariationDetail('my-flag', {});
      return () => h('div', JSON.stringify(d.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);

  expect(client.jsonVariationDetail).toHaveBeenCalledWith('my-flag', {});
  expect(wrapper.text()).toBe(JSON.stringify(detail));
});

it('useJsonVariationDetail subscribes to change:<key> on mount and unsubscribes on unmount', () => {
  const { client, controls } = makeMockClient();
  (client.jsonVariationDetail as jest.Mock).mockReturnValue({
    value: {},
    variationIndex: 0,
    reason: { kind: 'OFF' },
  });

  const Child = defineComponent({
    setup() {
      useJsonVariationDetail('my-flag', {});
      return () => h('div');
    },
  });

  const wrapper = mountUnderProvider(client, Child);
  expect(controls.handlerCount('change:my-flag')).toBe(1);

  wrapper.unmount();
  expect(controls.handlerCount('change:my-flag')).toBe(0);
});

it('useJsonVariationDetail re-renders with updated detail when change:<key> fires', async () => {
  const { client, controls } = makeMockClient();
  const initialDetail: LDEvaluationDetailTyped<object> = {
    value: { x: 1 },
    variationIndex: 0,
    reason: { kind: 'OFF' },
  };
  const updatedDetail: LDEvaluationDetailTyped<object> = {
    value: { x: 2 },
    variationIndex: 1,
    reason: { kind: 'FALLTHROUGH' },
  };
  (client.jsonVariationDetail as jest.Mock).mockReturnValue(initialDetail);

  const Child = defineComponent({
    setup() {
      const d = useJsonVariationDetail('my-flag', {});
      return () => h('div', JSON.stringify(d.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);
  expect(wrapper.text()).toBe(JSON.stringify(initialDetail));

  (client.jsonVariationDetail as jest.Mock).mockReturnValue(updatedDetail);
  controls.emitChange('my-flag');
  await nextTick();

  expect(wrapper.text()).toBe(JSON.stringify(updatedDetail));
});

it('useJsonVariationDetail re-evaluates when context changes after identify', async () => {
  const { client, controls } = makeMockClient();
  (client.jsonVariationDetail as jest.Mock).mockReturnValue({
    value: { a: 1 },
    variationIndex: 0,
    reason: { kind: 'OFF' },
  });

  const Child = defineComponent({
    setup() {
      useJsonVariationDetail('my-flag', {});
      return () => h('div');
    },
  });

  mountUnderProvider(client, Child);
  const callsBefore = (client.jsonVariationDetail as jest.Mock).mock.calls.length;

  controls.emitContextChange({ kind: 'user', key: 'new-user' });
  await nextTick();

  expect((client.jsonVariationDetail as jest.Mock).mock.calls.length).toBe(callsBefore + 1);
});

it('useJsonVariationDetail returns CLIENT_NOT_READY detail when not ready', () => {
  const { client } = makeMockClient({ ready: false, initializedState: 'initializing' });
  const defaultValue = { enabled: false };

  const Child = defineComponent({
    setup() {
      const d = useJsonVariationDetail('my-flag', defaultValue);
      return () => h('div', JSON.stringify(d.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);

  expect(client.jsonVariationDetail).not.toHaveBeenCalled();
  const rendered = JSON.parse(wrapper.text()) as LDEvaluationDetailTyped<object>;
  expect(rendered.value).toEqual(defaultValue);
  expect(rendered.variationIndex).toBeNull();
  expect(rendered.reason).toEqual(NOT_READY_REASON);
});

// reactive key re-subscription (one test per composable, covering the key change case)

it('useBoolVariationDetail re-evaluates and re-subscribes when key changes', async () => {
  const { client, controls } = makeMockClient();
  const detailA: LDEvaluationDetailTyped<boolean> = {
    value: false,
    variationIndex: 0,
    reason: { kind: 'OFF' },
  };
  const detailB: LDEvaluationDetailTyped<boolean> = {
    value: true,
    variationIndex: 1,
    reason: { kind: 'FALLTHROUGH' },
  };
  (client.boolVariationDetail as jest.Mock).mockImplementation((k: string, _def: boolean) => {
    if (k === 'flag-a') return detailA;
    if (k === 'flag-b') return detailB;
    return detailA;
  });

  const flagKey = ref('flag-a');

  const Child = defineComponent({
    setup() {
      const d = useBoolVariationDetail(flagKey, false);
      return () => h('div', JSON.stringify(d.value));
    },
  });

  const wrapper = mountUnderProvider(client, Child);
  expect(wrapper.text()).toBe(JSON.stringify(detailA));
  expect(controls.handlerCount('change:flag-a')).toBe(1);

  flagKey.value = 'flag-b';
  await nextTick();

  expect(wrapper.text()).toBe(JSON.stringify(detailB));
  expect(controls.handlerCount('change:flag-a')).toBe(0);
  expect(controls.handlerCount('change:flag-b')).toBe(1);
});
