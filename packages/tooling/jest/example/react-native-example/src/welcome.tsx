import { StyleSheet, Text, View } from 'react-native';
import { mockUseLDClient, mockFlags } from '@launchdarkly/jest';

export default function Welcome() {

  const flagValue = mockFlags({ 'dev-test-flag': true });

  const ldClient = mockUseLDClient();

  ldClient.track('test');

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