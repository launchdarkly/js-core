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
    id: 'ld-rn-fdv2-test-app',
    version: '0.0.1',
  },
  baseUri: 'http://192.168.7.152:3002/proxy-poll',
  streamUri: 'http://192.168.7.152:3001/proxy',
  // @ts-ignore dataSystem is @internal
  dataSystem: {},
});

const App = () => (
  <LDProvider client={featureClient}>
    <Welcome />
  </LDProvider>
);

export default App;
