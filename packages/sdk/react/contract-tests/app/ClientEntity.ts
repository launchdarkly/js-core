'use client';

import { useEffect } from 'react';

import {
  CommandParams,
  doCommand,
  IClientEntity,
} from '@launchdarkly/js-contract-test-utils/client';
import { useLDClient } from '@launchdarkly/react-sdk';

export type CommandHandler = (params: CommandParams) => Promise<unknown>;

/**
 * Creates an IClientEntity wrapper for a React-managed client.
 * The entity's doCommand delegates to the command handler registered
 * by ClientInstance once the React component mounts.
 */
export function createReactClientEntity(
  clientId: string,
  commandHandlers: Map<string, CommandHandler>,
  close: () => void,
): IClientEntity {
  return {
    doCommand: async (params: CommandParams) => {
      const handler = commandHandlers.get(clientId);
      if (!handler) {
        throw new Error(`No command handler registered for client ${clientId}`);
      }
      return handler(params);
    },
    close,
  };
}

export function ClientInstance({
  clientId,
  handlers,
  onReady,
}: {
  clientId: string;
  handlers: Map<string, CommandHandler>;
  onReady: (id: string) => void;
}) {
  const client = useLDClient();

  useEffect(() => {
    handlers.set(clientId, (params) => doCommand(client, params));
    onReady(clientId);
    return () => {
      handlers.delete(clientId);
    };
  }, [client, clientId, handlers, onReady]);

  return null;
}
