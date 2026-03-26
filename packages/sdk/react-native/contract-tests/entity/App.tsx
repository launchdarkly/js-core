import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Capability,
  CLIENT_SIDE_CAPABILITIES,
  IClientEntity,
  TestHarnessWebSocketBuilder,
} from '@launchdarkly/js-contract-test-utils/client';

import { newSdkClientEntity } from './src/ClientEntity';

const RN_CAPABILITIES: Capability[] = [...CLIENT_SIDE_CAPABILITIES, 'mobile'];

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
    const entities = new Map<string, IClientEntity>();
    const ws = new TestHarnessWebSocketBuilder()
      .setCapabilities(RN_CAPABILITIES)
      .onCreateClient(async (id, params) => {
        const entity = await newSdkClientEntity(id, params);
        entities.set(id, entity);
        return entity;
      })
      .onGetClient((id) => entities.get(id))
      .onDeleteClient((id) => {
        entities.get(id)?.close();
        entities.delete(id);
      })
      .onConnectionChange(setConnected)
      .build();
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
