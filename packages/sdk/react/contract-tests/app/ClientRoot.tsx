'use client';

import React, { useEffect, useState } from 'react';

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

const commandHandlers = new Map<string, CommandHandler>();
const handlerReadyMap = new Map<string, () => void>();
const entityMap = new Map<string, IClientEntity>();
let clientRecords: ClientRecord[] = [];

function onReady(readyId: string) {
  handlerReadyMap.get(readyId)?.();
}

export default function ClientRoot({ children }: { children: React.ReactNode }) {
  const [, setRenderTick] = useState(0);
  const rerender = () => setRenderTick((n) => n + 1);

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
          handlerReadyMap.set(id, resolve);
        });

        clientRecords = [...clientRecords, { id, client, Provider }];
        rerender();

        await handlerReady;
        handlerReadyMap.delete(id);

        const entity = createReactClientEntity(id, commandHandlers, () => client.close());
        entityMap.set(id, entity);
        return entity;
      })
      .onGetClient((id) => entityMap.get(id))
      .onDeleteClient((id) => {
        entityMap.delete(id);
        clientRecords.find((r) => r.id === id)?.client.close();
        clientRecords = clientRecords.filter((r) => r.id !== id);
        rerender();
      })
      .build();

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
