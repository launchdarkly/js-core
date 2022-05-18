import * as http from 'http';

import NodeRequests from '../src/NodeRequests';

const PORT = '3000';
const GET_TEXT = 'Test Text';

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
      res.end(GET_TEXT);
    });
    server.listen(PORT);
  });

  afterEach(async () => new Promise((resolveClose) => {
    server.close(resolveClose);
  }));

  const requests = new NodeRequests();
  it('it can make a basic get request', async () => {
    const req = await requests.fetch(`http://localhost:${PORT}`);
    const text = await req.text();
    expect(text).toEqual(GET_TEXT);
    const serverResult = await promise;
    expect(serverResult.method).toEqual('GET');
    expect(serverResult.body).toEqual('');
  });

  it('it can make a basic post', async () => {
    await requests.fetch(`http://localhost:${PORT}`, { method: 'POST', body: 'BODY TEXT' });
    const serverResult = await promise;
    expect(serverResult.method).toEqual('POST');
    expect(serverResult.body).toEqual('BODY TEXT');
  });

  it('it can make a request with headers', async () => {
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
