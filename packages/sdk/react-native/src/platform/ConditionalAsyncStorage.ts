/* eslint-disable global-require */

/**
 * The LaunchDarkly React-Native SDK uses
 * @react-native-async-storage/async-storage for bootstrapping. This is a native
 * dependency.
 *
 * If you are using expo, then adding the LaunchDarkly React Native
 * SDK from npm and re-running pod install should suffice.
 *
 * If you are not using expo, you will need to explicitly add
 * @react-native-async-storage/async-storage as a dependency to your project
 * and re-run pod install for auto-linking to work. This is because auto-link
 * does not work with transitive dependencies:
 * https://github.com/react-native-community/cli/issues/1347
 *
 */
import type { LDLogger } from '@launchdarkly/js-client-sdk-common';

export default function getAsyncStorage(logger: LDLogger): any {
  try {
    return require('@react-native-async-storage/async-storage').default;
  } catch (e) {
    // Use an in-memory fallback if async-storage is unavailable.
    // This preserves session-level persistence (flag caching, generated keys,
    // context index) but data will not survive app restarts.
    logger.warn(
      'AsyncStorage is not available. Using in-memory storage as a fallback - cached flags, generated keys, and context data will not persist across app restarts. Please see https://launchdarkly.github.io/js-core/packages/sdk/react-native/docs/interfaces/LDOptions.html#storage for more information.',
    );
    const memoryStore = new Map<string, string>();
    return {
      getItem: (key: string) => Promise.resolve(memoryStore.get(key) ?? null),
      setItem: (key: string, value: string) => {
        memoryStore.set(key, value);
        return Promise.resolve();
      },
      removeItem: (key: string) => {
        memoryStore.delete(key);
        return Promise.resolve();
      },
    };
  }
}
