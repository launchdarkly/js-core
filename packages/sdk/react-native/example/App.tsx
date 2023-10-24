import { CLIENT_SIDE_SDK_KEY } from '@env';

import { LDProvider, ReactNativeLDClient } from '@launchdarkly/react-native-client-sdk';

import Welcome from './src/welcome';

const featureClient = new ReactNativeLDClient(CLIENT_SIDE_SDK_KEY);
const context = { kind: 'user', key: 'test-user-1' };

const App = () => {
  return (
    <LDProvider client={featureClient} context={context}>
      <Welcome />
    </LDProvider>
  );
};

export default App;
