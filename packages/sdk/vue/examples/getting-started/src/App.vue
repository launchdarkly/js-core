<script setup>
import { useBoolVariation, useInitializationStatus } from '@launchdarkly/vue-client-sdk';
import { computed } from 'vue';

// Set flagKey to the feature flag key you want to evaluate.
const flagKey = import.meta.env.LAUNCHDARKLY_FLAG_KEY || 'sample-feature';

const status = useInitializationStatus();
const flagValue = useBoolVariation(flagKey, false);

const ready = computed(() => status.value.status !== 'initializing');

const statusMessage = computed(() => {
  if (status.value.status === 'complete') {
    return 'SDK successfully initialized!';
  }
  if (status.value.status === 'failed' || status.value.status === 'timeout') {
    return 'SDK failed to initialize. Please check your internet connection and SDK credential for any typo.';
  }
  return 'Initializing…';
});

// LaunchDarkly dark-mode toggle colors: off (#373841) when false, on (#00844B) when true.
const backgroundColor = computed(() => (ready.value && flagValue.value ? '#00844B' : '#373841'));
</script>

<template>
  <main class="hello" :style="{ backgroundColor }">
    <p>{{ statusMessage }}</p>
    <p v-if="ready">The {{ flagKey }} feature flag evaluates to {{ flagValue }}.</p>
  </main>
</template>

<style>
body {
  margin: 0;
}

.hello {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: Avenir, Helvetica, Arial, sans-serif;
  color: #ffffff;
}
</style>
