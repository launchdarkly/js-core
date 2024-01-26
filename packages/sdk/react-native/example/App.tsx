import { MOBILE_KEY } from '@env';

import { AutoEnvAttributes } from '@launchdarkly/js-client-sdk-common';
import { LDProvider, ReactNativeLDClient } from '@launchdarkly/react-native-client-sdk';

import Welcome from './src/welcome';

const featureClient = new ReactNativeLDClient(MOBILE_KEY, AutoEnvAttributes.Enabled);

const App = () => {
  return (
    <LDProvider client={featureClient}>
      <Welcome />
    </LDProvider>
  );
};

export default App;
