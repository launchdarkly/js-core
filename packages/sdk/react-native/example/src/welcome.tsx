import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { ConnectionMode } from '@launchdarkly/js-client-sdk-common';
import { useBoolVariation, useLDClient } from '@launchdarkly/react-native-client-sdk';

export default function Welcome() {
  const [flagKey, setFlagKey] = useState('sample-feature');
  const [userKey, setUserKey] = useState('');
  const flagValue = useBoolVariation(flagKey, false);
  const ldc = useLDClient();

  const onIdentify = () => {
    ldc
      .identify({ kind: 'user', key: userKey }, { timeout: 5 })
      .catch((e: any) => console.error(`error identifying ${userKey}: ${e}`));
  };

  const setConnectionMode = (m: ConnectionMode) => {
    ldc.setConnectionMode(m);
  };

  const context = ldc.getContext() ?? 'No context identified.';

  return (
    <View style={styles.container}>
      <Text>Welcome to LaunchDarkly</Text>
      <Text>
        {flagKey}: {`${flagValue}`}
      </Text>
      <ScrollView style={{ flexGrow: 0.5, backgroundColor: 'black', maxHeight: 200 }}>
        <Text style={{ color: 'orange' }}>Logging: {JSON.stringify(context, null, 2)}</Text>
      </ScrollView>
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
      <View style={styles.connectionModeContainer}>
        <TouchableOpacity
          style={styles.buttonContainer}
          onPress={() => setConnectionMode('offline')}
        >
          <Text style={styles.buttonText}>Set offline</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.buttonContainer}
          onPress={() => setConnectionMode('streaming')}
        >
          <Text style={styles.buttonText}>Set streaming</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.buttonContainer}
          onPress={() => setConnectionMode('polling')}
        >
          <Text style={styles.buttonText}>Set polling</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectionModeContainer: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
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
