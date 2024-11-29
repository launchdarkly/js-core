import { StyleSheet } from 'react-native';

import {
  AutoEnvAttributes,
  LDOptions,
  LDProvider,
  ReactNativeLDClient,
} from '@launchdarkly/react-native-client-sdk';

import Welcome from './src/welcome';

const options: LDOptions = {
  debug: true,
};
//TODO Set MOBILE_KEY in .env file to a mobile key in your project/environment.
const MOBILE_KEY = 'YOUR_MOBILE_KEY';
const featureClient = new ReactNativeLDClient(MOBILE_KEY, AutoEnvAttributes.Enabled, options);

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
