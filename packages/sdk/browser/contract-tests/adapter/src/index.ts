/* eslint-disable no-console */

/* eslint-disable @typescript-eslint/no-explicit-any */
import bodyParser from 'body-parser';
import cors from 'cors';
import { randomUUID } from 'crypto';
import express from 'express';
import http from 'node:http';
import util from 'node:util';
import { WebSocketServer } from 'ws';

let server: http.Server | undefined;

async function main() {
  const wss = new WebSocketServer({ port: 8001 });
  const waiters: Record<string, (data: unknown) => void> = {};

  console.log('Running contract test harness adapter.');
  wss.on('connection', async (ws) => {
    ws.on('error', console.error);

    ws.on('message', (stringData: string) => {
      const data = JSON.parse(stringData);
      if (Object.prototype.hasOwnProperty.call(waiters, data.reqId)) {
        waiters[data.reqId](data);
        delete waiters[data.reqId];
      } else {
        console.error('Did not find outstanding request', data.reqId);
      }
    });

    const send = (data: { [key: string]: unknown; reqId: string }): Promise<any> => {
      let resolver: (data: unknown) => void;
      const waiter = new Promise((resolve) => {
        resolver = resolve;
      });
      // @ts-expect-error The body of the above assignment runs sequentially.
      waiters[data.reqId] = resolver;
      ws.send(JSON.stringify(data));
      return waiter;
    };

    if (server) {
      await util.promisify(server.close).call(server);
      server = undefined;
    }

    const app = express();

    const port = 8000;

    app.use(
      cors({
        origin: '*',
        allowedHeaders: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      }),
    );
    app.use(bodyParser.json());

    app.get('/', async (_req, res) => {
      const commandResult = await send({ command: 'getCapabilities', reqId: randomUUID() });
      res.header('Content-Type', 'application/json');
      res.json(commandResult);
    });

    app.delete('/', () => {
      process.exit();
    });

    app.post('/', async (req, res) => {
      const commandResult = await send({
        command: 'createClient',
        body: req.body,
        reqId: randomUUID(),
      });
      if (commandResult.resourceUrl) {
        res.set('Location', commandResult.resourceUrl);
      }
      if (commandResult.status) {
        res.status(commandResult.status);
      }
      res.send();
    });

    app.post('/clients/:id', async (req, res) => {
      const commandResult = await send({
        command: 'runCommand',
        id: req.params.id,
        body: req.body,
        reqId: randomUUID(),
      });
      if (commandResult.status) {
        res.status(commandResult.status);
      }
      if (commandResult.body) {
        res.write(JSON.stringify(commandResult.body));
      }
      res.send();
    });

    app.delete('/clients/:id', async (req, res) => {
      await send({ command: 'deleteClient', id: req.params.id, reqId: randomUUID() });
      res.send();
    });

    server = app.listen(port, () => {
      console.log('Listening on port %d', port);
    });
  });
}
main();
