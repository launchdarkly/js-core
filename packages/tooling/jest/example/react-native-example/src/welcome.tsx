import { StyleSheet, Text, View } from 'react-native';
import { useLDClient } from '@launchdarkly/react-native-client-sdk';

export default function Welcome() {

  const ldClient = useLDClient();

  const flagValue = ldClient.boolVariation('my-boolean-flag', false);

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
