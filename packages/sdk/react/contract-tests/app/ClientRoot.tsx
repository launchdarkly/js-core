'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { CreateInstanceParams } from '@launchdarkly/js-contract-test-utils/client';
import {
  createClient,
  createLDReactProviderWithClient,
  LDReactClient,
} from '@launchdarkly/react-sdk';

import { ClientInstance, CommandHandler, makeSdkConfig } from './ClientEntity';
import TestHarnessWebSocket from './TestHarnessWebSocket';

interface ClientRecord {
  id: string;
  client: LDReactClient;
  Provider: React.FC<{ children: React.ReactNode }>;
}

export default function ClientRoot({ children }: { children: React.ReactNode }) {
  // Keeps a list of all the clients that we have, we will need to keep this as a state
  // to ensure that the ld client providers are being rendered.
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const commandHandlers = useRef(new Map<string, CommandHandler>());
  const handlerReadyMap = useRef(new Map<string, () => void>());
  const clientCounterRef = useRef(0);
  const clientsRef = useRef<ClientRecord[]>([]);

  useEffect(() => {
    const ws = new TestHarnessWebSocket(
      'ws://localhost:8001',
      commandHandlers.current,

      // On create client
      async (params: CreateInstanceParams) => {
        const id = String(clientCounterRef.current);
        clientCounterRef.current += 1;

        const timeout =
          params.configuration.startWaitTimeMs !== null &&
          params.configuration.startWaitTimeMs !== undefined
            ? params.configuration.startWaitTimeMs
            : 5000;

        const sdkConfig = makeSdkConfig(params.configuration, params.tag);
        const initialContext = params.configuration.clientSide?.initialUser ||
          params.configuration.clientSide?.initialContext || {
            kind: 'user',
            key: 'key-not-specified',
          };

        const client = createClient(
          params.configuration.credential || 'unknown-env-id',
          initialContext,
          sdkConfig,
        );

        const { status } = await client.start({ timeout: timeout / 1000 });

        if (status === 'failed' && !params.configuration.initCanFail) {
          client.close();
          throw new Error('client initialization failed');
        }

        // Currently these tests are creating the provider with a custom ld client, which is a
        // supported feature, but I think it would be better if we can use the create provider
        // factory function instead.
        const Provider = createLDReactProviderWithClient(client);

        const handlerReady = new Promise<void>((resolve) => {
          handlerReadyMap.current.set(id, resolve);
        });

        clientsRef.current = [...clientsRef.current, { id, client, Provider }];
        setClients((prev) => [...prev, { id, client, Provider }]);

        await handlerReady;
        handlerReadyMap.current.delete(id);
        return id;
      },

      // On delete client
      (id: string) => {
        clientsRef.current.find((r) => r.id === id)?.client.close();
        clientsRef.current = clientsRef.current.filter((r) => r.id !== id);
        setClients((prev) => prev.filter((r) => r.id !== id));
      },
    );

    ws.connect();
    return () => ws.disconnect();
  }, []);

  const onReady = useCallback((readyId: string) => {
    handlerReadyMap.current.get(readyId)?.();
  }, []);

  return (
    <>
      {children}
      {clients.map(({ id, Provider }) => (
        <Provider key={id}>
          <ClientInstance clientId={id} handlers={commandHandlers.current} onReady={onReady} />
        </Provider>
      ))}
    </>
  );
}
