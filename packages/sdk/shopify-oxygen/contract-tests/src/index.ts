import express, { Request, Response } from 'express';
import { Server } from 'http';

import { ClientPool } from './utils';

/* eslint-disable no-console */

// export DEBUG=true to enable debugging
// unset DEBUG to disable debugging
const debugging = process.env.DEBUG === 'true';

const app = express();
let server: Server | null = null;

app.use(express.json());

const port = 8000;

const clientPool = new ClientPool();

if (debugging) {
  app.use((req: Request, res: Response, next: Function) => {
    console.debug('request', req.method, req.url);
    if (req.body) {
      console.debug('request', JSON.stringify(req.body, null, 2));
    }
    next();
  });
} else {
  // NOOP global console.debug
  console.debug = () => {};
}

app.get('/', (req: Request, res: Response) => {
  res.header('Content-Type', 'application/json');
  res.json({
    capabilities: ['server-side-polling', 'server-side'],
  });
});

app.delete('/', (req: Request, res: Response) => {
  console.log('Test service has told us to exit');
  res.status(204);
  res.send();

  if (server) {
    server.close(() => process.exit());
  }
});

app.post('/', async (req: Request, res: Response) => {
  await clientPool.createClient(req.body, res);
});

app.post('/clients/:id', async (req: Request, res: Response) => {
  await clientPool.runCommand(req.params.id, req.body, res);
});

app.delete('/clients/:id', async (req: Request, res: Response) => {
  console.debug('DELETE request received /clients/:id');
  console.debug(req.params.id);
  await clientPool.deleteClient(req.params.id, res);
});

server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log('Listening on port %d', port);
});
