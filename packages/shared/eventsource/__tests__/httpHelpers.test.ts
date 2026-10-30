import {
  FetchHeaders,
  FetchLikeResponse,
  headersToObject,
  parseResponseHeaders,
  splitHeaderListValue,
} from '../src/httpHelpers';

it('splits a joined value on commas outside quotes', () => {
  expect(splitHeaderListValue('a, b, c')).toEqual(['a', ' b', ' c']);
});

it('keeps a comma inside a quoted parameter value', () => {
  expect(splitHeaderListValue('text/event-stream; x="a,b"')).toEqual([
    'text/event-stream; x="a,b"',
  ]);
});

it('treats a quoted-pair quote as part of the quoted value', () => {
  // The escaped quote does not close the quoted string, so the comma after the real closing
  // quote still splits the list.
  expect(splitHeaderListValue('text/event-stream;x="a\\"b", text/html')).toEqual([
    'text/event-stream;x="a\\"b"',
    ' text/html',
  ]);
});

it('keeps a comma that follows an escaped quote inside one element', () => {
  expect(splitHeaderListValue('text/event-stream;x="a\\",b"')).toEqual([
    'text/event-stream;x="a\\",b"',
  ]);
});

it('keeps a trailing backslash inside quotes as part of the last element', () => {
  expect(splitHeaderListValue('x="a\\')).toEqual(['x="a\\']);
});

it('runs an unterminated quoted string to the end of the value', () => {
  expect(splitHeaderListValue('text/event-stream;x="a, text/html')).toEqual([
    'text/event-stream;x="a, text/html',
  ]);
});

it('keeps empty parts', () => {
  expect(splitHeaderListValue('a,,b,')).toEqual(['a', '', 'b', '']);
});

it('returns null when the headers expose no iteration method', () => {
  expect(headersToObject({ get: () => null })).toBeNull();
});

it('collects headers through forEach and folds the names to lowercase', () => {
  expect(
    headersToObject({
      get: () => null,
      forEach: (callback) => {
        callback('text/event-stream', 'Content-Type');
      },
    }),
  ).toEqual({ 'content-type': 'text/event-stream' });
});

it('collects headers through entries when forEach is absent', () => {
  const pairs: [string, string][] = [['Content-Type', 'text/event-stream']];
  expect(
    headersToObject({
      get: () => null,
      entries: () => pairs,
    }),
  ).toEqual({ 'content-type': 'text/event-stream' });
});

function responseWith(headers: unknown): FetchLikeResponse {
  return { status: 200, headers: headers as FetchHeaders };
}

function iterates(record: Record<string, string>) {
  return (callback: (value: string, key: string) => void) => {
    Object.entries(record).forEach(([key, value]) => callback(value, key));
  };
}

const throws = () => {
  throw new Error('boom');
};

it.each([
  [
    'a string get result wins over the iterated record',
    { get: () => 'text/event-stream', forEach: iterates({ 'content-type': 'text/html' }) },
    {
      headers: { 'content-type': 'text/html' },
      contentType: 'text/event-stream',
      unreadable: false,
    },
  ],
  [
    'a throwing get falls back to the iterated record',
    { get: throws, forEach: iterates({ 'content-type': 'text/event-stream' }) },
    {
      headers: { 'content-type': 'text/event-stream' },
      contentType: 'text/event-stream',
      unreadable: false,
    },
  ],
  [
    'a non-string get result falls back to the iterated record',
    { get: () => 42, forEach: iterates({ 'content-type': 'text/event-stream' }) },
    {
      headers: { 'content-type': 'text/event-stream' },
      contentType: 'text/event-stream',
      unreadable: false,
    },
  ],
  [
    'a get that reports the header absent, without iteration, is readable',
    { get: () => null },
    { headers: {}, contentType: undefined, unreadable: false },
  ],
  [
    'a throwing get without iteration is unreadable',
    { get: throws },
    { headers: {}, contentType: undefined, unreadable: true },
  ],
  [
    'a non-string get result without iteration is unreadable',
    { get: () => 42 },
    { headers: {}, contentType: undefined, unreadable: true },
  ],
  [
    'headers with no access method are unreadable',
    {},
    { headers: {}, contentType: undefined, unreadable: true },
  ],
  [
    'a throwing iteration keeps no partial headers and is unreadable even when get works',
    {
      get: () => 'text/event-stream',
      forEach: (callback: (value: string, key: string) => void) => {
        callback('text/html', 'content-type');
        throw new Error('boom');
      },
    },
    { headers: {}, contentType: 'text/event-stream', unreadable: true },
  ],
  [
    'missing headers are unreadable',
    undefined,
    { headers: {}, contentType: undefined, unreadable: true },
  ],
])('parses response headers: %s', (_name, headers, expected) => {
  expect(parseResponseHeaders(responseWith(headers))).toEqual(expected);
});

it('reports a response whose headers getter throws as unreadable', () => {
  const res = { status: 200 };
  Object.defineProperty(res, 'headers', { get: throws });
  expect(parseResponseHeaders(res as FetchLikeResponse)).toEqual({
    headers: {},
    contentType: undefined,
    unreadable: true,
  });
});
