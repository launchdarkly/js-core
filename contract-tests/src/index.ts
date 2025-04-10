import bodyParser from 'body-parser';
import express, { Request, Response } from 'express';
import { Server } from 'http';

import { Log } from './log.js';
import { badCommandError, newSdkClientEntity, SdkClientEntity } from './sdkClientEntity.js';

const app = express();
let server: Server | null = null;

const port = 8000;

let clientCounter = 0;
const clients: Record<string, SdkClientEntity> = {};

const mainLog = Log('service');

app.use(bodyParser.json());

app.get('/', (req: Request, res: Response) => {
  res.header('Content-Type', 'application/json');
  res.json({
    capabilities: [
      'server-side-polling',
      'server-side',
      'all-flags-client-side-only',
      'all-flags-details-only-for-tracked-flags',
      'all-flags-with-reasons',
      'tags',
      'big-segments',
      'filtering',
      'filtering-strict',
      'user-type',
      'migrations',
      'event-sampling',
      'strongly-typed',
      'polling-gzip',
      'inline-context-all',
      'anonymous-redaction',
      'evaluation-hooks',
      'wrapper',
      'client-prereq-events',
      'event-gzip',
      'optional-event-gzip',
    ],
  });
});

app.delete('/', (req: Request, res: Response) => {
  mainLog.info('Test service has told us to exit');
  res.status(204);
  res.send();

  // Defer the following actions till after the response has been sent
  setTimeout(() => {
    if (server) {
      server.close(() => process.exit());
    }
    // We force-quit with process.exit because, even after closing the server, there could be some
    // scheduled tasks lingering if an SDK instance didn't get cleaned up properly, and we don't want
    // that to prevent us from quitting.
  }, 1);
});

app.post('/', async (req: Request, res: Response) => {
  const options = req.body;

  clientCounter += 1;
  const clientId = clientCounter.toString();
  const resourceUrl = `/clients/${clientId}`;

  try {
    const client = await newSdkClientEntity(options);
    clients[clientId] = client;

    res.status(201);
    res.set('Location', resourceUrl);
  } catch (e) {
    res.status(500);
    const message = e instanceof Error ? e.message : JSON.stringify(e);
    mainLog.error(`Error creating client: ${message}`);
    res.write(message);
  }
  res.send();
});

app.post('/clients/:id', async (req: Request, res: Response) => {
  const client = clients[req.params.id];
  if (!client) {
    res.status(404);
  } else {
    try {
      const respValue = await client.doCommand(req.body);
      if (respValue) {
        res.status(200);
        res.write(JSON.stringify(respValue));
      } else {
        res.status(204);
      }
    } catch (e) {
      const isBadRequest = e === badCommandError;
      res.status(isBadRequest ? 400 : 500);
      const message = e instanceof Error ? e.message : JSON.stringify(e);
      res.write(message);
      if (!isBadRequest && e instanceof Error && e.stack) {
        // eslint-disable-next-line no-console
        console.log(e.stack);
      }
    }
  }
  res.send();
});

app.delete('/clients/:id', async (req: Request, res: Response) => {
  const client = clients[req.params.id];
  if (!client) {
    res.status(404);
    res.send();
  } else {
    client.close();
    delete clients[req.params.id];
    res.status(204);
    res.send();
  }
});

server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log('Listening on port %d', port);
});
