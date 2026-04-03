import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { type FDv2ConnectionMode } from '@launchdarkly/js-client-sdk-common';
import { useBoolVariation, useLDClient } from '@launchdarkly/react-native-client-sdk';

const connectionModes: { label: string; mode?: FDv2ConnectionMode }[] = [
  { label: 'Streaming', mode: 'streaming' },
  { label: 'Polling', mode: 'polling' },
  { label: 'Offline', mode: 'offline' },
  { label: 'One-Shot', mode: 'one-shot' },
  { label: 'Background', mode: 'background' },
  { label: 'Automatic', mode: undefined },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  modeText: {
    fontSize: 16,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  connectionModeContainer: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  logBox: {
    flexGrow: 0,
    backgroundColor: '#1a1a1a',
    maxHeight: 150,
    width: '100%',
    borderRadius: 8,
    padding: 10,
    marginVertical: 10,
  },
  logText: {
    color: '#ffa500',
    fontFamily: 'monospace',
  },
  input: {
    height: 40,
    width: '80%',
    margin: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
  },
  buttonContainer: {
    elevation: 4,
    backgroundColor: '#009688',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  activeButton: {
    backgroundColor: '#00695c',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  buttonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
    alignSelf: 'center',
    textTransform: 'uppercase',
  },
});

export default function Welcome() {
  const [flagKey, setFlagKey] = useState('sample-feature');
  const [userKey, setUserKey] = useState('');
  const [currentMode, setCurrentMode] = useState<string>('streaming');
  const flagValue = useBoolVariation(flagKey, false);
  const ldc = useLDClient();

  const onIdentify = () => {
    ldc
      .identify({ kind: 'user', key: userKey }, { timeout: 5 })
      // eslint-disable-next-line no-console
      .catch((e: any) => console.error(`error identifying ${userKey}: ${e}`));
  };

  const onSetConnectionMode = (mode?: FDv2ConnectionMode) => {
    // @ts-ignore setConnectionMode is @internal - experimental FDv2 opt-in
    ldc.setConnectionMode(mode);
    setCurrentMode(mode ?? 'automatic');
  };

  const context = ldc.getContext() ?? 'No context identified.';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LaunchDarkly FDv2 Demo</Text>
      <Text style={styles.modeText}>Mode: {currentMode}</Text>
      <Text>
        {flagKey}: {`${flagValue}`}
      </Text>
      <ScrollView style={styles.logBox}>
        <Text style={styles.logText}>Context: {JSON.stringify(context, null, 2)}</Text>
      </ScrollView>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        onChangeText={setUserKey}
        onSubmitEditing={onIdentify}
        value={userKey}
        placeholder="User key"
      />
      <TouchableOpacity onPress={onIdentify} style={styles.buttonContainer}>
        <Text style={styles.buttonText}>Identify</Text>
      </TouchableOpacity>
      <TextInput
        style={styles.input}
        autoCapitalize="none"
        onChangeText={setFlagKey}
        value={flagKey}
        placeholder="Flag key"
      />
      <Text style={styles.sectionTitle}>Connection Modes</Text>
      <View style={styles.connectionModeContainer}>
        {connectionModes.map(({ label, mode }) => (
          <TouchableOpacity
            key={label}
            style={[
              styles.buttonContainer,
              currentMode === (mode ?? 'automatic') && styles.activeButton,
            ]}
            onPress={() => onSetConnectionMode(mode)}
          >
            <Text style={styles.buttonText}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
