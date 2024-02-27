/* eslint-disable import/no-mutable-exports,global-require */

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
let ConditionalAsyncStorage: any;

try {
  ConditionalAsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch (e) {
  // Use a mock if async-storage is unavailable
  ConditionalAsyncStorage = {
    getItem: (_key: string) => Promise.resolve(null),
    setItem: (_key: string, _value: string) => Promise.resolve(),
    removeItem: (_key: string) => Promise.resolve(),
  };
}

export default ConditionalAsyncStorage;
