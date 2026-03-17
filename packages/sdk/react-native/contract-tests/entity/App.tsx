import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { TestHarnessWebSocket } from '@launchdarkly/js-contract-test-utils/client';

import { newSdkClientEntity } from './src/ClientEntity';

const RN_CAPABILITIES = [
  'client-side',
  'mobile',
  'service-endpoints',
  'tags',
  'user-type',
  'inline-context-all',
  'anonymous-redaction',
  'strongly-typed',
  'client-prereq-events',
  'client-per-context-summaries',
  'track-hooks',
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  status: {
    fontSize: 16,
    marginTop: 10,
  },
});

export default function App() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new TestHarnessWebSocket(
      'ws://localhost:8001',
      RN_CAPABILITIES,
      newSdkClientEntity,
      setConnected,
    );
    ws.connect();
    return () => ws.disconnect();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>RN Contract Test Entity</Text>
      <Text style={styles.status}>WebSocket: {connected ? 'Connected' : 'Disconnected'}</Text>
    </View>
  );
}
