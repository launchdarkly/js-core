import { CLIENT_SIDE_SDK_KEY } from '@env';

import { LDProvider } from '@launchdarkly/react-native-client-sdk';

import Welcome from './src/welcome';

const context = { kind: 'user', key: 'test-user-1' };

const App = () => {
  return (
    <LDProvider clientSideSdkKey={CLIENT_SIDE_SDK_KEY} context={context}>
      <Welcome />
    </LDProvider>
  );
};

export default App;
