import * as http from 'http';

import NodeRequests from '../src/NodeRequests';

const PORT = '3000';
const TEXT_RESPONSE = 'Test Text';
const JSON_RESPONSE = '{"text": "value"}';

interface TestRequestData {
  body: string;
  method: string | undefined;
  headers: http.IncomingHttpHeaders;
}

describe('given a default instance of NodeRequests', () => {
  let resolve: (value: TestRequestData | PromiseLike<TestRequestData>) => void;
  let promise: Promise<TestRequestData>;
  let server: http.Server;

  beforeEach(() => {
    promise = new Promise<TestRequestData>((res) => {
      resolve = res;
    });
    server = http.createServer((req, res) => {
      const chunks: any[] = [];
      req.on('data', (chunk) => {
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve({
          method: req.method,
          body: Buffer.concat(chunks).toString(),
          headers: req.headers,
        });
      });
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain');
      if ((req.url?.indexOf('json') || -1) >= 0) {
        res.end(JSON_RESPONSE);
      } else if ((req.url?.indexOf('interrupt') || -1) >= 0) {
        res.destroy();
      } else if ((req.url?.indexOf('404') || -1) >= 0) {
        res.statusCode = 404;
        res.end();
      } else {
        res.end(TEXT_RESPONSE);
      }
    });
    server.listen(PORT);
  });

  afterEach(async () => new Promise((resolveClose) => {
    server.close(resolveClose);
  }));

  const requests = new NodeRequests();
  it('can make a basic get request', async () => {
    const res = await requests.fetch(`http://localhost:${PORT}`);
    expect(res.headers.get('content-type')).toEqual('text/plain');
    expect(res.status).toEqual(200);
    const text = await res.text();
    expect(text).toEqual(TEXT_RESPONSE);
    const serverResult = await promise;
    expect(serverResult.method).toEqual('GET');
    expect(serverResult.body).toEqual('');
  });

  it('can get json from a response', async () => {
    const res = await requests.fetch(`http://localhost:${PORT}/json`);
    expect(res.headers.get('content-type')).toEqual('text/plain');
    const json = await res.json();
    expect(json).toEqual({ text: 'value' });
    const serverResult = await promise;
    expect(serverResult.method).toEqual('GET');
    expect(serverResult.body).toEqual('');
  });

  it(
    'can handle errors establishing a connection',
    async () => expect(async () => requests.fetch(`http://badurl:${PORT}/json`))
      .rejects.toThrow(),
  );

  it(
    'can handle handle errors after a connection is established',
    async () => expect(async () => requests.fetch(`http://localhost:${PORT}/interrupt`))
      .rejects.toThrow(),
  );

  it('can handle status codes', async () => {
    const res = await requests.fetch(`http://localhost:${PORT}/404`);
    expect(res.headers.get('content-type')).toEqual('text/plain');
    expect(res.status).toEqual(404);

    const serverResult = await promise;
    expect(serverResult.method).toEqual('GET');
    expect(serverResult.body).toEqual('');
  });

  it('can make a basic post', async () => {
    await requests.fetch(`http://localhost:${PORT}`, { method: 'POST', body: 'BODY TEXT' });
    const serverResult = await promise;
    expect(serverResult.method).toEqual('POST');
    expect(serverResult.body).toEqual('BODY TEXT');
  });

  it('can make a request with headers', async () => {
    await requests.fetch(`http://localhost:${PORT}`, {
      method: 'POST',
      body: 'BODY TEXT',
      headers: {
        'Sample-Header': 'Some header value',
      },
    });
    const serverResult = await promise;
    expect(serverResult.method).toEqual('POST');
    expect(serverResult.body).toEqual('BODY TEXT');
    expect(serverResult.headers['sample-header']).toEqual('Some header value');
  });
});
