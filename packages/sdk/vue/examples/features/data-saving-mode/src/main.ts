import { createApp } from 'vue';
import { LDVuePlugin } from '@launchdarkly/vue-client-sdk';

import App from './App.vue';
import { initialContext, LAUNCHDARKLY_CLIENT_SIDE_ID, ldOptions } from './LDClient';
import './index.css';

createApp(App)
  .use(LDVuePlugin, {
    clientSideID: LAUNCHDARKLY_CLIENT_SIDE_ID,
    context: initialContext,
    ldOptions,
  })
  .mount('#app');
