import { headersToObject, splitHeaderListValue } from '../src/httpHelpers';

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

it('returns an empty object when the headers expose no forEach', () => {
  expect(headersToObject({})).toEqual({});
});
