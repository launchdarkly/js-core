import type { LDContext } from '@launchdarkly/js-client-sdk';
import type { App } from 'vue';

import type { LDVueProviderOptions } from './client/LDOptions';
import { createClient } from './client/LDVueClient';
import { createReactiveInstance, LDVueInstanceKey } from './client/provider/LDVueContext';

/**
 * Options for installing the LaunchDarkly Vue plugin.
 */
export interface LDVuePluginOptions extends LDVueProviderOptions {
  /**
   * The LaunchDarkly client-side ID.
   */
  clientSideID: string;

  /**
   * The initial LaunchDarkly context.
   */
  context: LDContext;
}

/**
 * Vue plugin that creates a LaunchDarkly client and provides it app-wide.
 *
 * By default the client starts immediately. Pass `deferInitialization: true` in options
 * to opt out of auto-start and call `client.start()` yourself via {@link useLDClient}.
 *
 * @remarks
 * Because the plugin provides the client at the app level it cannot gate rendering via
 * slots. Use {@link useInitializationStatus} to react to the initialization state, or
 * prefer {@link createLDProvider} when slot-based gating is needed.
 *
 * @example
 * ```ts
 * import { createApp } from 'vue';
 * import { LDVuePlugin } from '@launchdarkly/vue-client-sdk';
 * import App from './App.vue';
 *
 * createApp(App)
 *   .use(LDVuePlugin, {
 *     clientSideID: 'your-client-side-id',
 *     context: { kind: 'user', key: 'user-key' },
 *   })
 *   .mount('#app');
 * ```
 */
export const LDVuePlugin = {
  install(app: App, options: LDVuePluginOptions) {
    const { clientSideID, context, deferInitialization, startOptions, ldOptions, bootstrap, injectionKey } =
      options;

    const client = createClient(clientSideID, context, ldOptions);

    if (!deferInitialization) {
      const effectiveStartOptions = bootstrap ? { ...startOptions, bootstrap } : startOptions;
      client.start(effectiveStartOptions);
    }

    const { value, dispose } = createReactiveInstance(client);
    app.provide(injectionKey ?? LDVueInstanceKey, value);
    // `app.onUnmount` is available in Vue 3.5+. In older versions the subscriptions are
    // held for the lifetime of the client (acceptable for a single-app install).
    if (typeof (app as { onUnmount?: unknown }).onUnmount === 'function') {
      (app as { onUnmount: (fn: () => void) => void }).onUnmount(dispose);
    }
  },
};
