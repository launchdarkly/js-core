import { MOBILE_KEY } from '@env';

import {
  AutoEnvAttributes,
  LDProvider,
  ReactNativeLDClient,
} from '@launchdarkly/react-native-client-sdk';

import Welcome from './src/welcome';

const featureClient = new ReactNativeLDClient(MOBILE_KEY, AutoEnvAttributes.Enabled, {
  debug: true,
  applicationInfo: {
    id: 'ld-rn-test-app',
    version: '0.0.1',
  },
});

const App = () => {
  return (
    <LDProvider client={featureClient}>
      <Welcome />
    </LDProvider>
  );
};

export default App;
