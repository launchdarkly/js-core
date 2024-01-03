import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useBoolVariation, useLDClient } from '@launchdarkly/react-native-client-sdk';

export default function Welcome() {
  const [flagKey, setFlagKey] = useState('my-boolean-flag-1');
  const [userKey, setUserKey] = useState('');
  const flagValue = useBoolVariation(flagKey, false);
  const ldc = useLDClient();

  const onIdentify = () => {
    ldc
      .identify({ kind: 'user', key: userKey })
      .catch((e: any) => console.error(`error identifying ${userKey}: ${e}`));
  };

  return (
    <View style={styles.container}>
      <Text>Welcome to LaunchDarkly</Text>
      <Text>
        {flagKey}: {`${flagValue}`}
      </Text>
      <Text>context: {JSON.stringify(ldc.getContext())}</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        onChangeText={setUserKey}
        onSubmitEditing={onIdentify}
        value={userKey}
        testID="userKey"
      />
      <TouchableOpacity onPress={onIdentify} style={styles.buttonContainer}>
        <Text style={styles.buttonText}>identify</Text>
      </TouchableOpacity>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        onChangeText={setFlagKey}
        value={flagKey}
        testID="flagKey"
      />
      <TouchableOpacity style={styles.buttonContainer}>
        <Text style={styles.buttonText}>get flag value</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    height: 40,
    margin: 12,
    borderWidth: 1,
    padding: 10,
  },
  buttonContainer: {
    elevation: 8,
    backgroundColor: '#009688',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  buttonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
    alignSelf: 'center',
    textTransform: 'uppercase',
  },
});
