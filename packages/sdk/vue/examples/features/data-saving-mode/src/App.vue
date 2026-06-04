<template>
  <div class="App">
    <h1>LaunchDarkly Vue FDv2 Demo</h1>
    <p class="status">{{ statusMessage }}</p>

    <section>
      <h2>Flag</h2>
      <p>
        <code>{{ FLAG_KEY }}</code> = <strong>{{ ready ? String(flagValue) : '...' }}</strong>
      </p>
    </section>

    <section>
      <h2>Connection mode</h2>
      <p>Current: <strong>{{ mode }}</strong></p>
      <div class="buttons">
        <button v-for="m in CONNECTION_MODES" :key="m" @click="onSetConnectionMode(m)">
          {{ m }}
        </button>
        <button @click="onSetConnectionMode(undefined)">automatic (clear)</button>
      </div>
    </section>

    <section>
      <h2>Streaming</h2>
      <p>Current: <strong>{{ streaming }}</strong></p>
      <div class="buttons">
        <button @click="onSetStreaming(true)">setStreaming(true)</button>
        <button @click="onSetStreaming(false)">setStreaming(false)</button>
        <button @click="onSetStreaming(undefined)">setStreaming(undefined)</button>
      </div>
    </section>

    <section>
      <h2>Context</h2>
      <p>Current: <code>{{ JSON.stringify(CONTEXTS[contextIndex]) }}</code></p>
      <div class="buttons">
        <button @click="onSwitchContext">Switch context (identify)</button>
      </div>
    </section>

    <section>
      <h2>Log</h2>
      <pre class="log">{{ log.join('\n') }}</pre>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

import {
  useBoolVariation,
  useInitializationStatus,
  useLDClient,
} from '@launchdarkly/vue-client-sdk';
import type { LDContext } from '@launchdarkly/vue-client-sdk';

const FLAG_KEY = import.meta.env.LAUNCHDARKLY_FLAG_KEY ?? 'sample-feature';

// FDv2 connection modes the data system supports.
const CONNECTION_MODES = ['streaming', 'polling', 'offline', 'one-shot', 'background'] as const;
type ConnectionMode = (typeof CONNECTION_MODES)[number];

const CONTEXTS: LDContext[] = [
  { kind: 'user', key: 'example-user-key', name: 'Sandy' },
  { kind: 'user', key: 'example-user-key-2', name: 'Alex' },
];

const initStatus = useInitializationStatus();
const flagValue = useBoolVariation(FLAG_KEY, false);
const ldc = useLDClient();

const mode = ref<string>('automatic');
const streaming = ref<string>('default');
const contextIndex = ref(0);
const log = ref<string[]>([]);

function addLog(line: string) {
  log.value = [`${new Date().toISOString().slice(11, 23)}  ${line}`, ...log.value].slice(0, 25);
}

function onSetConnectionMode(next?: ConnectionMode) {
  // setConnectionMode is part of the FDv2 data saving mode EAP -- not yet on the public
  // TypeScript interface. Cast required until the API stabilises.
  (ldc as any).setConnectionMode(next);
  mode.value = next ?? 'automatic';
  addLog(`setConnectionMode(${next ?? 'undefined'})`);
}

function onSetStreaming(next?: boolean) {
  ldc.setStreaming(next);
  streaming.value = next === undefined ? 'default' : String(next);
  addLog(`setStreaming(${next === undefined ? 'undefined' : next})`);
}

async function onSwitchContext() {
  const next = (contextIndex.value + 1) % CONTEXTS.length;
  contextIndex.value = next;
  addLog(`identify(${JSON.stringify(CONTEXTS[next])})`);
  const result = await ldc.identify(CONTEXTS[next]);
  addLog(`identify result: ${result.status}`);
}

const ready = computed(() => initStatus.value.status !== 'initializing');

const statusMessage = computed(() => {
  const s = initStatus.value.status;
  if (s === 'complete') return 'SDK successfully initialized.';
  if (s === 'failed') return 'SDK failed to initialize. Check your client-side ID and network.';
  if (s === 'timeout') return 'SDK timed out during initialization.';
  return 'Initializing...';
});
</script>

<style scoped>
.App {
  max-width: 640px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}

.App h1 {
  font-size: 22px;
}

.App h2 {
  font-size: 15px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #5a5f6b;
  margin-bottom: 6px;
}

.status {
  font-style: italic;
  color: #5a5f6b;
}

section {
  border-top: 1px solid #e1e3e8;
  padding: 12px 0;
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.buttons button {
  background-color: #405bff;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 14px;
  cursor: pointer;
}

.buttons button:hover {
  background-color: #2f47cc;
}

.log {
  background-color: #1a1a1a;
  color: #ffa500;
  font-family: monospace;
  font-size: 12px;
  border-radius: 6px;
  padding: 10px;
  max-height: 200px;
  overflow: auto;
  white-space: pre-wrap;
}
</style>
