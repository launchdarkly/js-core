'use client';

import React, { useEffect, useRef, useState } from 'react';

import {
  CLIENT_SIDE_CAPABILITIES,
  IClientEntity,
  makeDefaultInitialContext,
  TestHarnessWebSocketBuilder,
} from '@launchdarkly/js-contract-test-utils/client';
import {
  createClient,
  createLDReactProviderWithClient,
  LDReactClient,
} from '@launchdarkly/react-sdk';

import {
  ClientInstance,
  CommandHandler,
  createReactClientEntity,
  makeSdkConfig,
} from './ClientEntity';

interface ClientRecord {
  id: string;
  client: LDReactClient;
  Provider: React.FC<{ children: React.ReactNode }>;
}

export default function ClientRoot({ children }: { children: React.ReactNode }) {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const commandHandlers = useRef(new Map<string, CommandHandler>());
  const handlerReadyMap = useRef(new Map<string, () => void>());
  const clientsRef = useRef<ClientRecord[]>([]);
  // Entity map for the WS builder's get/delete callbacks
  const entityMap = useRef(new Map<string, IClientEntity>());

  const onReady = (readyId: string) => {
    handlerReadyMap.current.get(readyId)?.();
  };

  useEffect(() => {
    const ws = new TestHarnessWebSocketBuilder()
      .setCapabilities(CLIENT_SIDE_CAPABILITIES)
      .onCreateClient(async (id, params) => {
        const timeout =
          params.configuration.startWaitTimeMs !== null &&
          params.configuration.startWaitTimeMs !== undefined
            ? params.configuration.startWaitTimeMs
            : 5000;

        const sdkConfig = makeSdkConfig(params.configuration, params.tag);
        const initialContext =
          params.configuration.clientSide?.initialUser ||
          params.configuration.clientSide?.initialContext ||
          makeDefaultInitialContext();

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

        const Provider = createLDReactProviderWithClient(client);

        const handlerReady = new Promise<void>((resolve) => {
          handlerReadyMap.current.set(id, resolve);
        });

        clientsRef.current = [...clientsRef.current, { id, client, Provider }];
        setClients([...clientsRef.current]);

        await handlerReady;
        handlerReadyMap.current.delete(id);

        const entity = createReactClientEntity(id, commandHandlers.current, () => client.close());
        entityMap.current.set(id, entity);
        return entity;
      })
      .onGetClient((id) => entityMap.current.get(id))
      .onDeleteClient((id) => {
        entityMap.current.delete(id);
        clientsRef.current.find((r) => r.id === id)?.client.close();
        clientsRef.current = clientsRef.current.filter((r) => r.id !== id);
        setClients((prev) => prev.filter((r) => r.id !== id));
      })
      .build();

    ws.connect();
    return () => ws.disconnect();
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
