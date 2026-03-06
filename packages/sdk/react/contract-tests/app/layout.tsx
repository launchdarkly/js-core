'use client';

import React, { useEffect, useRef, useState } from 'react';

import {
  createClient,
  createLDReactProviderWithClient,
  LDReactClient,
} from '@launchdarkly/react-sdk';

import { ClientInner, CommandHandler, makeSdkConfig } from './ClientEntity';
import { CreateInstanceParams } from './ConfigParams';
import TestHarnessWebSocket from './TestHarnessWebSocket';

interface ClientRecord {
  id: string;
  client: LDReactClient;
  Provider: React.FC<{ children: React.ReactNode }>;
}

export default function App({ children }: { children: React.ReactNode }) {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const commandHandlers = useRef(new Map<string, CommandHandler>());
  const handlerReadyMap = useRef(new Map<string, () => void>());
  const clientCounterRef = useRef(0);

  useEffect(() => {
    const ws = new TestHarnessWebSocket(
      'ws://localhost:8001',
      commandHandlers.current,

      async (params: CreateInstanceParams) => {
        const id = String(clientCounterRef.current);
        clientCounterRef.current += 1;
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

        const timeout =
          params.configuration.startWaitTimeMs !== null &&
          params.configuration.startWaitTimeMs !== undefined
            ? params.configuration.startWaitTimeMs
            : 5000;

        let failed = false;
        try {
          await Promise.race([
            client.start(),
            new Promise<never>((_resolve, reject) => {
              setTimeout(reject, timeout);
            }),
          ]);
        } catch {
          failed = true;
        }

        if (failed && !params.configuration.initCanFail) {
          client.close();
          throw new Error('client initialization failed');
        }

        const Provider = createLDReactProviderWithClient(client);

        const handlerReady = new Promise<void>((resolve) => {
          handlerReadyMap.current.set(id, resolve);
        });

        setClients((prev) => [...prev, { id, client, Provider }]);

        await handlerReady;
        handlerReadyMap.current.delete(id);
        return id;
      },

      (id: string) => {
        setClients((prev) => {
          const record = prev.find((r) => r.id === id);
          if (record) {
            record.client.close();
          }
          return prev.filter((r) => r.id !== id);
        });
      },
    );

    ws.connect();
    return () => ws.disconnect();
  }, []);

  return (
    <html lang="en">
      <body>
        {children}
        {clients.map(({ id, Provider }) => (
          <Provider key={id}>
            <ClientInner
              clientId={id}
              handlers={commandHandlers.current}
              onReady={(readyId) => handlerReadyMap.current.get(readyId)?.()}
            />
          </Provider>
        ))}
      </body>
    </html>
  );
}
