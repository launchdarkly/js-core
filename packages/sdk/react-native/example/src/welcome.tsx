import { StyleSheet, Text, View } from 'react-native';

import {
  useBoolVariation,
  useLDClient,
  useLDDataSourceStatus,
} from '@launchdarkly/react-native-client-sdk';

export default function Welcome() {
  const { error, status } = useLDDataSourceStatus();
  const client = useLDClient();
  const flag = client.boolVariation('dev-test-flag', false);

  // TODO: debug why typed variation hooks don't work.
  // const flag = useBoolVariation('dev-test-flag', false);
  console.log(`============== status: ${status}`);

  return (
    <View style={styles.container}>
      <Text>Welcome to LaunchDarkly</Text>
      <Text>status: {status}</Text>
      <Text>error: {error?.message}</Text>
      <Text>devTestFlag: {`${flag}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: 60,
    height: 60,
    marginVertical: 20,
  },
});
