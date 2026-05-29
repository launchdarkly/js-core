/* eslint-disable no-console */
import bodyParser from 'body-parser';
import cors from 'cors';
import { randomUUID } from 'crypto';
import express from 'express';
import http from 'node:http';
import util from 'node:util';
import { WebSocketServer } from 'ws';

export interface AdapterOptions {
  restPort?: number;
  wsPort?: number;
  /**
   * How long (ms) the adapter waits for the browser entity to answer a command
   * before failing the REST request. Prevents a single unanswered command from
   * wedging the adapter (and therefore the test harness) indefinitely.
   * Override with ADAPTER_REQUEST_TIMEOUT_MS. Defaults to 30s.
   */
  requestTimeoutMs?: number;
}

/**
 * Tracks an outstanding command sent to the browser entity, awaiting its
 * response over the WebSocket.
 */
interface Waiter {
  resolve: (data: any) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

let server: http.Server | undefined;

export function startAdapter(options?: AdapterOptions) {
  const restPort = options?.restPort ?? 8000;
  const wsPort = options?.wsPort ?? 8001;
  const requestTimeoutMs =
    options?.requestTimeoutMs ?? Number(process.env.ADAPTER_REQUEST_TIMEOUT_MS ?? 30000);

  const wss = new WebSocketServer({ port: wsPort });

  console.log('Running contract test harness adapter.');
  wss.on('connection', async (ws) => {
    ws.on('error', console.error);

    // Outstanding commands awaiting a response over THIS socket. Scoped per
    // connection (not shared across the adapter) so that closing one socket
    // only fails its own in-flight commands and never rejects waiters that
    // belong to another, e.g. reconnecting, connection.
    const waiters: Record<string, Waiter> = {};

    ws.on('message', (stringData: string) => {
      const data = JSON.parse(stringData);
      const waiter = waiters[data.reqId];
      if (waiter) {
        clearTimeout(waiter.timer);
        delete waiters[data.reqId];
        waiter.resolve(data);
      } else {
        console.error('Did not find outstanding request', data.reqId);
      }
    });

    // When this socket drops, fail its outstanding commands instead of leaving
    // those REST requests (and the harness) hanging forever.
    ws.on('close', () => {
      Object.keys(waiters).forEach((reqId) => {
        const waiter = waiters[reqId];
        clearTimeout(waiter.timer);
        delete waiters[reqId];
        waiter.reject(new Error('WebSocket connection to entity closed before a response was received.'));
      });
    });

    const send = (data: { [key: string]: unknown; reqId: string }): Promise<any> =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          delete waiters[data.reqId];
          reject(
            new Error(
              `Adapter timed out after ${requestTimeoutMs}ms awaiting entity response to '${data.command}' (reqId ${data.reqId}).`,
            ),
          );
        }, requestTimeoutMs);
        waiters[data.reqId] = { resolve, reject, timer };
        ws.send(JSON.stringify(data));
      });

    // Wrap async route handlers so an unanswered/timed-out command produces a
    // 500 for that single request rather than an unhandled rejection that
    // leaves the request — and the harness — hanging.
    const guard =
      (
        handler: (req: express.Request, res: express.Response) => Promise<void>,
      ): express.RequestHandler =>
      (req, res) => {
        handler(req, res).catch((err) => {
          console.error('Adapter request failed:', err);
          if (!res.headersSent) {
            res.status(500).send(String(err));
          }
        });
      };

    if (server) {
      await util.promisify(server.close).call(server);
      server = undefined;
    }

    const app = express();

    app.use(
      cors({
        origin: '*',
        allowedHeaders: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      }),
    );
    app.use(bodyParser.json());

    app.get(
      '/',
      guard(async (_req, res) => {
        const commandResult = await send({ command: 'getCapabilities', reqId: randomUUID() });
        res.header('Content-Type', 'application/json');
        res.json(commandResult);
      }),
    );

    app.delete('/', () => {
      process.exit();
    });

    app.post(
      '/',
      guard(async (req, res) => {
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
      }),
    );

    app.post(
      '/clients/:id',
      guard(async (req, res) => {
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
      }),
    );

    app.delete(
      '/clients/:id',
      guard(async (req, res) => {
        await send({ command: 'deleteClient', id: req.params.id, reqId: randomUUID() });
        res.send();
      }),
    );

    server = app.listen(restPort, () => {
      console.log('Listening on port %d', restPort);
    });
    // Surface bind failures (e.g. EADDRINUSE) instead of silently never
    // logging "Listening on port".
    server.on('error', (err) => {
      console.error(`REST server error on port ${restPort}:`, err);
    });
  });
}
