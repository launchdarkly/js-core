import { createLDProvider } from '@launchdarkly/vue-client-sdk';
import { createApp, h } from 'vue';

import App from './App.vue';

// Set clientSideID to your LaunchDarkly client-side ID.
const clientSideID = import.meta.env.LAUNCHDARKLY_CLIENT_SIDE_ID || '';

// Set up the evaluation context. This context should appear on your LaunchDarkly contexts dashboard soon after you run the demo.
const context = { kind: 'user', key: 'example-user-key', name: 'Sandy' };

const LDProvider = createLDProvider(clientSideID, context, { ldOptions: { streaming: true } });

createApp({
  render: () => h(LDProvider, null, { default: () => h(App) }),
}).mount('#app');
