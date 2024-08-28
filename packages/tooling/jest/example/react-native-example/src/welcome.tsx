import { StyleSheet, Text, View } from 'react-native';
import { useBoolVariation, useLDClient } from '@launchdarkly/react-native-client-sdk';

export default function Welcome() {

  //TODO Set my-boolean-flag to a valid boolean flag key in your project/environment.
  const flagValue = useBoolVariation('my-boolean-flag', false);

  const ldClient = useLDClient();

  ldClient.track('test event');

  return (
    <View style={styles.container}>
      <Text>Welcome to LaunchDarkly</Text>
      <Text>Flag value is {`${flagValue}`}</Text>
    </View>
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