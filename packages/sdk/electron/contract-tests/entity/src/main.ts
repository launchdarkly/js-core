import bodyParser from 'body-parser';
// eslint-disable-next-line import/no-extraneous-dependencies
import { app } from 'electron';
import express from 'express';

import ClientFactory from './ClientFactory';

// This is a workaround so we can use electron-forge to "build" the application without
// actually launching it. This is necessary because electron-forge v7 does not have a
// build command.
if (process.argv.includes('--build')) {
  process.exit(0);
}

const capabilities = [
  'client-side',
  'mobile',
  // This is a required feature since electron SDK uses a shared localstorage for all clients.
  // Which would cause issues with flag evaluations when multiple clients are created.
  'singleton',
  'service-endpoints',
  'tags',
  'user-type',
  'inline-context-all',
  'anonymous-redaction',
  'strongly-typed',
  'client-prereq-events',
  'client-per-context-summaries',
  'track-hooks',
  'tls:skip-verify-peer',
  'secure-mode-hash',
  'event-gzip',

  /// ////////////////////////////
  // TODO: this is not working for some reason. sdk-1873
  // 'http-proxy',
  // TODO: something is wrong here where the client is
  // hanging when TLS fails to verify. sdk-1876
  // 'tls:verify-peer',
  'tls:custom-ca',
];

const clientFactory = new ClientFactory();

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  const server = express();
  server.use(bodyParser.json());

  server.get('/', (_req, res) => {
    res.header('Content-Type', 'application/json');
    res.json({ capabilities });
  });

  server.post('/', async (req, res) => {
    try {
      const id = await clientFactory.createClient(req.body);
      const resourceUrl = `/clients/${id}`;
      res.status(201);
      res.set('Location', resourceUrl);
    } catch (error) {
      res.status(500);
      res.json({ error: error.message });
    }

    res.send();
  });

  server.post('/clients/:id', async (req, res) => {
    try {
      const result = await clientFactory.runCommand(req.params.id, req.body);
      res.status(200);
      res.json(result);
    } catch (error) {
      res.status(500);
      res.json({ error: error.message });
    }
  });

  server.delete('/clients/:id', async (req, res) => {
    await clientFactory.deleteClient(req.params.id);
    res.status(204);
    res.send();
  });

  server.delete('/', (_req, res) => {
    res.status(204);
    res.send();

    // Defer the following actions till after the response has been sent
    setTimeout(() => {
      app.quit();
    }, 1);
  });

  server.listen(8000, () => {
    // eslint-disable-next-line no-console
    console.log('Server is running on port 8000');
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
