// We have to use a custom entrypoint for monorepo workspaces to work.
// https://docs.expo.dev/guides/monorepos/#change-default-entrypoint
import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
