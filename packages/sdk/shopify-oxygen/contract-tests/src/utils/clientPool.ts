import { Response } from 'express';

import { ClientPool as GenericClientPool } from '@launchdarkly/js-contract-test-utils';
import { LDClient } from '@launchdarkly/js-server-sdk-common';
import { init } from '@launchdarkly/shopify-oxygen-sdk';

/* eslint-disable no-console */

/**
 * ClientPool manages a pool of LDClient instances for Shopify Oxygen contract tests.
 * It uses the shared generic ClientPool for client storage and ID generation, and
 * handles the Oxygen-specific client creation, command execution, and response sending.
 *
 * @see https://github.com/launchdarkly/sdk-test-harness/blob/v2/docs/service_spec.md
 */
export default class ClientPool {
  private _pool = new GenericClientPool<LDClient>();

  public async runCommand(id: string, body: any, res: Response): Promise<void> {
    const client = this._pool.get(id);
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
    const client = this._pool.get(id);
    if (client) {
      client.close();
      this._pool.remove(id);
      res.status(204);
      res.send();
    } else {
      res.status(404);
      res.send();
    }
  }

  public async createClient(options: any, res: Response): Promise<void> {
    try {
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
      const id = this._pool.add(client);
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
