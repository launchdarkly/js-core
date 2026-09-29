import bodyParser from 'body-parser';
import express, { Request, Response } from 'express';

import { newStreamEntity, StreamEntity } from './streamEntity.js';

const app = express();

const port = 8000;

let streamCounter = 0;
// A Map, not a plain object: a stream id from the URL such as "constructor" must miss
// cleanly instead of finding an Object prototype member.
const streams = new Map<string, StreamEntity>();

app.use(bodyParser.json());

app.get('/', (req: Request, res: Response) => {
  res.header('Content-Type', 'application/json');
  res.json({
    capabilities: [
      'event-type-listeners',
      'headers',
      'post',
      'report',
      'read-timeout',
      'last-event-id',
      'server-directed-shutdown-request',
      // The parser strips one leading byte-order mark even when the mark arrives split across
      // reads, so the harness's split-BOM tests apply.
      'bom',
    ],
  });
});

app.delete('/', (req: Request, res: Response) => {
  console.log('Test service has told us to exit');
  res.status(204);
  res.send();

  // Defer the following actions till after the response has been sent.
  setTimeout(() => {
    process.exit();
  }, 1);
});

app.post('/', (req: Request, res: Response) => {
  const options = req.body;

  if (!options.streamUrl || !options.callbackUrl) {
    res.status(400);
    res.send();
    return;
  }

  streamCounter += 1;
  const streamId = streamCounter.toString();
  const streamResourceUrl = `/streams/${streamId}`;

  streams.set(streamId, newStreamEntity(options));

  res.status(201);
  res.set('Location', streamResourceUrl);
  res.send();
});

app.post('/streams/:id', (req: Request, res: Response) => {
  const stream = streams.get(req.params.id);
  if (!stream) {
    res.status(404);
  } else if (!stream.doCommand(req.body)) {
    res.status(400);
  } else {
    res.status(204);
  }
  res.send();
});

app.delete('/streams/:id', (req: Request, res: Response) => {
  const stream = streams.get(req.params.id);
  if (!stream) {
    res.status(404);
    res.send();
    return;
  }
  stream.close();
  streams.delete(req.params.id);
  res.status(204);
  res.send();
});

app.listen(port, () => {
  console.log('Listening on port %d', port);
});
