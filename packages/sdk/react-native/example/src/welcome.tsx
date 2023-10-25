import { StyleSheet, Text, View } from 'react-native';

import { useBoolVariation, useLDContextInfo } from '@launchdarkly/react-native-client-sdk';

export default function Welcome() {
  const { error, identifyStatus } = useLDContextInfo();
  const flag = useBoolVariation('dev-test-flag', false);

  return (
    <View style={styles.container}>
      <Text>Welcome to LaunchDarkly</Text>
      <Text>status: {identifyStatus}</Text>
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
