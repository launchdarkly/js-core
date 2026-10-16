import {
  followStreamingRedirects,
  MAX_STREAMING_REDIRECT_HOPS,
  RedirectResponseSource,
} from '../../../src/internal/fetch/followRedirects';

interface FakeResponse extends RedirectResponseSource {
  destroyed: boolean;
}

function makeResponse(
  statusCode: number,
  headers: Record<string, string | string[] | undefined> = {},
): FakeResponse {
  const res: FakeResponse = {
    statusCode,
    headers,
    destroyed: false,
    destroy: () => {
      res.destroyed = true;
    },
  };
  return res;
}

/** Builds a doRequest that serves canned responses by URL and records each requested URL. */
function makeServer(routes: Record<string, () => FakeResponse>) {
  const requested: string[] = [];
  const doRequest = async (url: string): Promise<FakeResponse> => {
    requested.push(url);
    const route = routes[url];
    if (!route) {
      throw new Error(`no route for ${url}`);
    }
    return route();
  };
  return { requested, doRequest };
}

it('returns a non-redirect response without another request', async () => {
  const { requested, doRequest } = makeServer({
    'http://origin/stream': () => makeResponse(200),
  });
  const res = await followStreamingRedirects('http://origin/stream', doRequest);
  expect(res.statusCode).toEqual(200);
  expect(requested).toEqual(['http://origin/stream']);
});

it.each([301, 307])('follows a %s redirect to an absolute target', async (status) => {
  const { requested, doRequest } = makeServer({
    'http://origin/stream': () => makeResponse(status, { location: 'http://origin/moved' }),
    'http://origin/moved': () => makeResponse(200),
  });
  const res = await followStreamingRedirects('http://origin/stream', doRequest);
  expect(res.statusCode).toEqual(200);
  expect(requested).toEqual(['http://origin/stream', 'http://origin/moved']);
});

it.each([
  ['https://origin/stream', 'http://other.example/s'],
  ['http://origin/stream', 'https://other.example/s'],
])('follows a redirect across hosts and schemes (%s -> %s)', async (start, target) => {
  const { requested, doRequest } = makeServer({
    [start]: () => makeResponse(307, { location: target }),
    [target]: () => makeResponse(200),
  });
  await followStreamingRedirects(start, doRequest);
  expect(requested).toEqual([start, target]);
});

it('resolves a relative target against the current hop, not the original URL', async () => {
  const { requested, doRequest } = makeServer({
    'http://origin/stream': () => makeResponse(301, { location: 'http://other.example/a/b' }),
    'http://other.example/a/b': () => makeResponse(307, { location: '/c' }),
    'http://other.example/c': () => makeResponse(200),
  });
  await followStreamingRedirects('http://origin/stream', doRequest);
  expect(requested).toEqual([
    'http://origin/stream',
    'http://other.example/a/b',
    'http://other.example/c',
  ]);
});

it('destroys each followed redirect response before the next hop request', async () => {
  // The order matters. A destroy that waits for the next hop would hold the redirect
  // response's connection, and an agent with a socket limit could never issue the hop.
  const first = makeResponse(301, { location: 'http://origin/moved' });
  let destroyedBeforeHop = false;
  const { doRequest } = makeServer({
    'http://origin/stream': () => first,
    'http://origin/moved': () => {
      destroyedBeforeHop = first.destroyed;
      return makeResponse(200);
    },
  });
  const res = await followStreamingRedirects('http://origin/stream', doRequest);
  expect(destroyedBeforeHop).toBe(true);
  expect(res.destroyed).toBe(false);
});

it('does not follow a 302', async () => {
  const { requested, doRequest } = makeServer({
    'http://origin/stream': () => makeResponse(302, { location: 'http://origin/moved' }),
  });
  const res = await followStreamingRedirects('http://origin/stream', doRequest);
  expect(res.statusCode).toEqual(302);
  expect(requested).toEqual(['http://origin/stream']);
});

it.each([
  ['a missing Location', {}],
  ['an empty Location', { location: '' }],
  ['an unparsable Location', { location: 'http://' }],
  ['a non-http scheme', { location: 'file:///etc/passwd' }],
])('returns the redirect response unfollowed for %s', async (_desc, headers) => {
  const { requested, doRequest } = makeServer({
    'http://origin/stream': () => makeResponse(301, headers),
  });
  const res = await followStreamingRedirects('http://origin/stream', doRequest);
  expect(res.statusCode).toEqual(301);
  expect(requested).toEqual(['http://origin/stream']);
});

it('uses the first value of a multi-value Location', async () => {
  const { requested, doRequest } = makeServer({
    'http://origin/stream': () =>
      makeResponse(301, { location: ['http://origin/moved', 'http://origin/other'] }),
    'http://origin/moved': () => makeResponse(200),
  });
  await followStreamingRedirects('http://origin/stream', doRequest);
  expect(requested).toEqual(['http://origin/stream', 'http://origin/moved']);
});

it('returns the last redirect response when a chain exceeds the hop limit', async () => {
  const { requested, doRequest } = makeServer({
    'http://origin/loop': () => makeResponse(301, { location: 'http://origin/loop' }),
  });
  const res = await followStreamingRedirects('http://origin/loop', doRequest);
  expect(res.statusCode).toEqual(301);
  // The initial request plus one request per allowed hop.
  expect(requested).toHaveLength(MAX_STREAMING_REDIRECT_HOPS + 1);
});

it('propagates a rejection from a hop request', async () => {
  const { doRequest } = makeServer({
    'http://origin/stream': () => makeResponse(307, { location: 'http://origin/moved' }),
  });
  await expect(followStreamingRedirects('http://origin/stream', doRequest)).rejects.toThrow(
    'no route for http://origin/moved',
  );
});

it('ignores a throwing destroy', async () => {
  const first = makeResponse(301, { location: 'http://origin/moved' });
  first.destroy = () => {
    throw new Error('cannot destroy');
  };
  const { doRequest } = makeServer({
    'http://origin/stream': () => first,
    'http://origin/moved': () => makeResponse(200),
  });
  const res = await followStreamingRedirects('http://origin/stream', doRequest);
  expect(res.statusCode).toEqual(200);
});
