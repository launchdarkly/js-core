import { MOBILE_KEY } from '@env';

import { LDProvider, ReactNativeLDClient } from '@launchdarkly/react-native-client-sdk';

import Welcome from './src/welcome';

const featureClient = new ReactNativeLDClient(MOBILE_KEY);

const App = () => {
  return (
    <LDProvider client={featureClient}>
      <Welcome />
    </LDProvider>
  );
};

export default App;
