import { Response } from 'express';

import { LDClient } from '@launchdarkly/js-server-sdk-common';
import { init } from '@launchdarkly/shopify-oxygen-sdk';

/* eslint-disable no-console */

// NOTE: Currently, this is a very simple client pool that only really handles the
// very limited Oxygen specific use cases... we should be expand this to be more
// general purpose in the future and maybe even come up with some shared ts interface
// to facilitate future contract testing.

// TODO: currently this class will handle the response sending as well, which may technically
// sit outside the scope of what it SHOULD be doing. We should refactor this to be more
// general purpose and allow the caller to handle the response sending.

/**
 * ClientPool is a singleton that manages a pool of LDClient instances. Currently there is
 * no separation between a managed client and this pool. Which means all of the client specs
 * will be implemented in this class.
 *
 * @see https://github.com/launchdarkly/sdk-test-harness/blob/v2/docs/service_spec.md
 */
export default class ClientPool {
  private _clients: Record<string, LDClient> = {};
  private _clientCounter = 0;

  constructor() {
    this._clients = {};
    this._clientCounter = 0;
  }

  private _makeId(): string {
    this._clientCounter += 1;
    return `client-${this._clientCounter}`;
  }

  public async runCommand(id: string, body: any, res: Response): Promise<void> {
    const client = this._clients[id];
    // TODO: handle the 'itCanFailCase'
    if (client) {
      try {
        const { command, ...rest } = body;
        switch (command) {
          case 'evaluate': {
            const { flagKey, context, defaultValue, detail } = rest.evaluate;
            const evaluation = detail
              ? await client.variationDetail(flagKey, context, defaultValue)
              : await client.variation(flagKey, context, defaultValue);
            res.status(200);
            res.json({ value: evaluation });
            break;
          }
          default: {
            res.status(400);
            res.json({ error: `Unknown command: ${command}` });
            break;
          }
        }
      } catch (err) {
        console.error(`Error running command: ${err}`);
        res.status(500);
        res.send();
      }
    } else {
      res.status(404);
      res.send();
    }
  }

  public async deleteClient(id: string, res: Response): Promise<void> {
    const client = this._clients[id];
    if (client) {
      client.close();
      delete this._clients[id];
      res.status(204);
      res.send();
    } else {
      res.status(404);
      res.send();
    }
  }

  public async createClient(options: any, res: Response): Promise<void> {
    try {
      const id = this._makeId();
      const {
        configuration: { credential = 'unknown-sdk-key', polling },
      } = options;

      if (!polling) {
        // We do not support non-polling clients yet
        res.status(400);
        res.send();
        return;
      }
      const client = await init(credential, {
        ...(polling && {
          baseUri: polling.baseUri,
        }),
      });

      await client.waitForInitialization({ timeout: 10 });
      this._clients[id] = client;
      res.status(201);
      res.set('Location', `/clients/${id}`);
      if (!client.initialized()) {
        res.status(500);
        client.close();
        res.send();
        return;
      }
      console.debug(`Creating client with configuration: ${JSON.stringify(options.configuration)}`);
      res.send();
    } catch (err) {
      console.error(`Error creating client: ${err}`);
      res.status(500);
      res.send();
    }
  }
}
