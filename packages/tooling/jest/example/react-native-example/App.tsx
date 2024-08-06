import { StyleSheet } from 'react-native';
import { mockReactNativeLDClient} from '@launchdarkly/jest/react-native';
import { LDProvider } from '@launchdarkly/react-native-client-sdk';
import Welcome from './src/welcome';

const featureClient = mockReactNativeLDClient();

const userContext = { kind: 'user', key: '', anonymous: true };

export default function App() {

  featureClient.identify(userContext).catch((e: any) => console.log(e));

  return (
    <LDProvider client={featureClient}>
      <Welcome />
    </LDProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});