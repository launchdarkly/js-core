import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';

import { useBoolVariation, useLDClient } from '@launchdarkly/react-native-client-sdk';

export default function Welcome() {
  const flag = useBoolVariation('dev-test-flag', false);
  const ldc = useLDClient();
  const [userKey, setUserKey] = useState('test-user-1');

  const login = () => {
    console.log(`identifying: ${userKey}`);
    ldc.identify({ kind: 'user', key: userKey });
  };

  return (
    <View style={styles.container}>
      <Text>Welcome to LaunchDarkly</Text>
      <Text>devTestFlag: {`${flag}`}</Text>
      <Text>context: {JSON.stringify(ldc.getContext())}</Text>
      <TextInput
        style={styles.input}
        onChangeText={setUserKey}
        onSubmitEditing={login}
        value={userKey}
      />
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
  input: {
    height: 40,
    margin: 12,
    borderWidth: 1,
    padding: 10,
  },
});
