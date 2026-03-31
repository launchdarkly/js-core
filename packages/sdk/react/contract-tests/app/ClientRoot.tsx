'use client';

import React, { useEffect, useState } from 'react';

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

const commandHandlers = new Map<string, CommandHandler>();
const handlerReadyMap = new Map<string, () => void>();
let clientRecords: ClientRecord[] = [];
let clientCounter = 0;

function onReady(readyId: string) {
  handlerReadyMap.get(readyId)?.();
}

export default function ClientRoot({ children }: { children: React.ReactNode }) {
  const [, setRenderTick] = useState(0);
  const rerender = () => setRenderTick((n) => n + 1);

  useEffect(() => {
    const ws = new TestHarnessWebSocket(
      'ws://localhost:8001',
      commandHandlers,

      // On create client
      async (params: CreateInstanceParams) => {
        const id = String(clientCounter);
        clientCounter += 1;

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

        const Provider = createLDReactProviderWithClient(client);

        const handlerReady = new Promise<void>((resolve) => {
          handlerReadyMap.set(id, resolve);
        });

        clientRecords = [...clientRecords, { id, client, Provider }];
        rerender();

        await handlerReady;
        handlerReadyMap.delete(id);
        return id;
      },

      // On delete client
      (id: string) => {
        clientRecords.find((r) => r.id === id)?.client.close();
        clientRecords = clientRecords.filter((r) => r.id !== id);
        rerender();
      },
    );

    ws.connect();
    return () => ws.disconnect();
  }, []);

  return (
    <>
      {children}
      {clientRecords.map(({ id, Provider }) => (
        <Provider key={id}>
          <ClientInstance clientId={id} handlers={commandHandlers} onReady={onReady} />
        </Provider>
      ))}
    </>
  );
}
