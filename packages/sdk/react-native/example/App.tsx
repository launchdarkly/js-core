import { MOBILE_KEY } from '@env';

import {
  AutoEnvAttributes,
  LDProvider,
  ReactNativeLDClient,
} from '@launchdarkly/react-native-client-sdk';

import Welcome from './src/welcome';

const featureClient = new ReactNativeLDClient("mob-8b772ad8-5d5b-435f-982a-900fa5db47e6", AutoEnvAttributes.Enabled, {
  debug: true,
  eventsUri: 'https://eb5d04264133.ngrok.app',
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
