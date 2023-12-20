import { lazy } from 'react';
// @ts-ignore
// eslint-disable-next-line import/no-extraneous-dependencies
import { AsyncStorage } from 'react-native';

// eslint-disable-next-line import/no-mutable-exports
let ConditionalAsyncStorage = AsyncStorage;

if (!ConditionalAsyncStorage) {
  console.log('============ @react-native-async-storage/async-storage');
  /**
   * The LaunchDarkly SDK uses async-storage for bootstrapping and this is a native
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
   */
  // eslint-disable-next-line global-require
  // ConditionalAsyncStorage = require('@react-native-async-storage/async-storage').default;
  // @ts-ignore
  ConditionalAsyncStorage = lazy(() => import('@react-native-async-storage/async-storage'));
} else {
  console.log('============ Native AsyncStorage');
}

export default ConditionalAsyncStorage;
