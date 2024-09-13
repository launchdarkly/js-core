/* eslint-disable @typescript-eslint/no-explicit-any */
import { WebSocketServer } from 'ws';
import bodyParser from 'body-parser';
import express from 'express';
import cors from 'cors';
import http from 'node:http';
import util from 'node:util';

import { randomUUID } from 'crypto';

let server: http.Server | undefined;

async function main() {
  const wss = new WebSocketServer({ port: 8001 });
  const waiters: Record<string, (data: unknown) => void> = {};

  console.log("Running");
  wss.on('connection', async (ws) => {
    ws.on('error', console.error);

    ws.on('message', function message(stringData: string) {
      const data = JSON.parse(stringData);
      console.log('received: %s', data);
      if(Object.prototype.hasOwnProperty.call(waiters, data.reqId)) {
        console.log("Resolving waiter", data.reqId);
        waiters[data.reqId](data);
        delete waiters[data.reqId];
      } else {
        console.log("Did not find outstanding request", data.reqId);
      }
    });

    const send = (data: {[key:string]: unknown, reqId: string}): Promise<any> => {
      let resolver: (data: unknown) => void;
      const waiter = new Promise((resolve) => {
        resolver = resolve;
      });
      // @ts-expect-error The body of the above assignment runs sequentially.
      waiters[data.reqId] = resolver;
      ws.send(JSON.stringify(data));
      return waiter;
    };

    if(server) {
      await util.promisify(server.close).call(server);
      server = undefined;
    }

    const app = express();

    const port = 8000;

    app.use(cors({origin: '*', allowedHeaders: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']}));
    app.use(bodyParser.json());

    app.get('/', (req, res) => {
      res.header('Content-Type', 'application/json');
      res.json({
        capabilities: [
          'client-side',
          'service-endpoints',
          'tags',
          'user-type',
          'inline-context',
          'anonymous-redaction',
        ],
      });
    });

    app.delete('/', () => {
      process.exit();
    });

    app.post('/', async (req, res) => {
      const commandResult = await send({command: 'createClient', body: req.body, reqId: randomUUID()});
      console.log(commandResult);
      if(commandResult.resourceUrl) {
        console.log("Setting location header");
        res.set('Location', commandResult.resourceUrl);
      }
      if(commandResult.status) {
        console.log('Setting status', commandResult.status)
        res.status(commandResult.status);
      }
      console.log("responding");
      res.send();
      console.log("responded");
    });

    app.post('/clients/:id', async (req, res) => {
      console.log("POST FOR CLIENT");
      const commandResult = await send({command: 'runCommand', id: req.params.id, body: req.body, reqId: randomUUID()});
      console.log(commandResult);
      if(commandResult.status) {
        res.status(commandResult.status);
      }
      if(commandResult.body) {
        res.write(JSON.stringify(commandResult.body));
      }
      res.send();
    });

    app.delete('/clients/:id', async (req, res) => {
      console.log("DELETE FOR CLIENT");
      const commandResult = await send({command: 'deleteClient', id: req.params.id, reqId: randomUUID()});
      console.log(commandResult);
      res.send();
    });

    server = app.listen(port, () => {
      console.log('Listening on port %d', port);
    });
  });

}
main();
