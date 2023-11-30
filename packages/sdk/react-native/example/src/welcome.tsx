import { Button, StyleSheet, Text, View } from 'react-native';

import {
  useBoolVariation,
  useLDClient,
  useLDDataSourceStatus,
} from '@launchdarkly/react-native-client-sdk';

export default function Welcome() {
  const { error, status } = useLDDataSourceStatus();
  const flag = useBoolVariation('dev-test-flag', false);
  const ldc = useLDClient();
  const login = () => {
    ldc.identify({ kind: 'user', key: 'test-user-2' });
  };

  return (
    <View style={styles.container}>
      <Text>Welcome to LaunchDarkly</Text>
      <Text>status: {status ?? 'not connected'}</Text>
      {error ? <Text>error: {error.message}</Text> : null}
      <Text>devTestFlag: {`${flag}`}</Text>
      <Button title="Login" onPress={login} />
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
