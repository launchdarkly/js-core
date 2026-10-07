import { splitHeaderListValue } from '../src/httpHelpers';

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

it('keeps a quoted-pair comma inside one element', () => {
  expect(splitHeaderListValue('text/event-stream;x="a\\",b"')).toEqual([
    'text/event-stream;x="a\\",b"',
  ]);
});

it('runs an unterminated quoted string to the end of the value', () => {
  expect(splitHeaderListValue('text/event-stream;x="a, text/html')).toEqual([
    'text/event-stream;x="a, text/html',
  ]);
});

it('keeps empty parts', () => {
  expect(splitHeaderListValue('a,,b,')).toEqual(['a', '', 'b', '']);
});
