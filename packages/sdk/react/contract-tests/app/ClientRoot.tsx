'use client';

import React, { useEffect, useRef, useState } from 'react';

import {
  Capability,
  ConfigBuilder,
  IClientEntity,
  TestHarnessWebSocketBuilder,
} from '@launchdarkly/js-contract-test-utils/client';
import {
  createClient,
  createLDReactProviderWithClient,
  LDContext,
  LDOptions,
  LDReactClient,
} from '@launchdarkly/react-sdk';

import { ClientInstance, CommandHandler, createReactClientEntity } from './ClientEntity';

interface ClientRecord {
  id: string;
  client: LDReactClient;
  Provider: React.FC<{ children: React.ReactNode }>;
}

const CAPABILITIES: Capability[] = [
  'client-side',
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

export default function ClientRoot({ children }: { children: React.ReactNode }) {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const commandHandlers = useRef(new Map<string, CommandHandler>());
  const handlerReadyMap = useRef(new Map<string, () => void>());
  const clientsRef = useRef<ClientRecord[]>([]);
  const entityMap = useRef(new Map<string, IClientEntity>());

  const onReady = (readyId: string) => {
    handlerReadyMap.current.get(readyId)?.();
  };

  useEffect(() => {
    const ws = new TestHarnessWebSocketBuilder()
      .setCapabilities(CAPABILITIES)
      .onCreateClient(async (id, params) => {
        const config = new ConfigBuilder(params).set({ fetchGoals: false });

        const client = createClient(
          config.credential,
          config.initialContext as LDContext,
          config.build() as LDOptions,
        );

        const { status } = await client.start({ timeout: config.timeout / 1000 });

        if (status === 'failed' && !config.initCanFail) {
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
